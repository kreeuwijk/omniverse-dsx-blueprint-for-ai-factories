
import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Side = "top" | "right" | "bottom" | "left"
type Align = "start" | "center" | "end"

export type TooltipWrapperProps = {
    text: React.ReactNode
    children: React.ReactNode
    side?: Side
    align?: Align
    sideOffset?: number
    delayDuration?: number
    contentClassName?: string
    wrapDisabled?: boolean
    disabled?: boolean
    maxWidthClassName?: string
    asChildTrigger?: boolean
}

export const TooltipWrapper = React.forwardRef<
    React.ElementRef<typeof TooltipTrigger>,
    TooltipWrapperProps & React.ComponentPropsWithoutRef<typeof TooltipTrigger>
>(function TooltipWrapper(
    {
        text,
        children,
        side = "top",
        align = "center",
        sideOffset = 6,
        delayDuration,
        wrapDisabled = false,
        disabled = false,
        asChildTrigger = true,
        ...triggerProps
    },
    ref
) {
    const isValidElement = React.isValidElement(children)

    const FallbackNode = (
        <span className={cn(disabled && "cursor-not-allowed opacity-80", "inline-flex")}>
            {children}
        </span>
    )

    const TriggerChild = wrapDisabled && disabled
        ? FallbackNode
        : isValidElement
            ? (children as React.ReactElement)
            : FallbackNode

    return (
        <TooltipProvider delayDuration={delayDuration}>
            <Tooltip>
                {asChildTrigger ? (
                    <TooltipTrigger
                        ref={ref}
                        asChild
                        {...triggerProps}
                    >
                        {TriggerChild}
                    </TooltipTrigger>
                ) : (
                    <TooltipTrigger
                        ref={ref}
                        className="inline-flex"
                        {...triggerProps}
                    >
                        {TriggerChild}
                    </TooltipTrigger>
                )}
                <TooltipContent
                    side={side}
                    align={align}
                    sideOffset={sideOffset}
                >
                    <div className="whitespace-pre-line leading-snug">{text}</div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
})
