import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

interface ToggleButtonProps {
    icon: LucideIcon;
    active: boolean;
    disabled?: boolean;
    action: ToggleActionType;
    onClick?: () => void;
}

// Toggle actions only (excludes SET_ACTIVE_CAMERA which requires additional params)
type ToggleActionType = "TOGGLE_CONFIGURATOR" | "TOGGLE_ANALYTICS" | "TOGGLE_SIMULATIONS" | "TOGGLE_VIEWER" | "TOGGLE_AGENT";

// ToggleButtonNative: A native button component that displays an icon and dispatches an action - ref is forwarded to the button element.
export const ToggleButtonNative = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
    ({ icon: Icon, active, disabled, action, onClick, ...rest }, ref) => {
        const { dispatch } = useUI();

        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    "focus-visible:ring-white/70 ring-offset-transparent",
                    "disabled:opacity-50 disabled:pointer-events-none",
                    "h-11 w-11 cursor-pointer",
                    active ? "bg-white text-black shadow-md" : "text-white/70 hover:bg-white/20",
                )}
                disabled={disabled}
                onClick={() => dispatch({ type: action })}
                {...rest}
            >
                <Icon style={{ width: "24px", height: "24px" }} />
            </button>
        );
    }
);
ToggleButtonNative.displayName = "ToggleButtonNative";
