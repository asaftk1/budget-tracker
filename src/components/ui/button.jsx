import * as React from "react";
import { cn } from '../../lib/utils';

// True when the caller supplied its own background colour class (not a variant like hover:bg-*).
const hasBackgroundClass = (className = "") => /(^|\s)bg-/.test(className);

// variant "default": solid primary background unless the caller passes its own bg-* class.
// variant "outline": white background with a border.
export const Button = React.forwardRef(({ className, variant = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md px-4 py-2",
      variant === "outline"
        ? "border border-input bg-background text-gray-900 hover:bg-gray-50"
        : cn("text-white hover:opacity-90", !hasBackgroundClass(className) && "bg-primary"),
      className
    )}
    {...props}
  />
));

Button.displayName = "Button";
