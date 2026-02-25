import React from "react";
import { LucideIcon } from "lucide-react";

interface IconButtonProps {
  icon: LucideIcon;
  disabled?: boolean;
  className?: string;
  size?: number
}

// IconButtonNative: A native button component that displays an icon - ref is forwarded to the button element.
const IconButtonNative = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, disabled, className, size = 24, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={`rounded-lg p-2 cursor-pointer ${className ?? "text-white/70 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"}`}
        {...props} 
      >
        <Icon width={size} height={size} />
      </button>
    );
  }
);
IconButtonNative.displayName = "IconButtonNative";

export default IconButtonNative;