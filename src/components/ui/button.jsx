import * as React from "react";
import { cn } from '../../lib/utils';

// True when the caller supplied its own background colour class (not a variant like hover:bg-*).
const hasBackgroundClass = (className = "") => /(^|\s)bg-/.test(className);

// Variants. Each one lists its background separately: a caller that passes its own bg-* class
// replaces the variant background (cn() only joins strings, it does not resolve conflicts).
//   default      solid primary, white text
//   secondary    light primary tint, primary text
//   outline      white with a border
//   ghost        no background until hovered
//   destructive  solid danger red, white text
const VARIANTS = {
  default: { base: "text-white", bg: "bg-primary hover:bg-primary-hover", ownBgHover: "hover:opacity-90" },
  secondary: { base: "text-primary", bg: "bg-primary-soft hover:bg-muted", ownBgHover: "hover:opacity-90" },
  outline: { base: "border border-input text-foreground", bg: "bg-background hover:bg-muted", ownBgHover: "hover:opacity-90" },
  ghost: { base: "text-foreground", bg: "hover:bg-muted", ownBgHover: "hover:opacity-90" },
  destructive: { base: "text-white", bg: "bg-danger hover:opacity-90", ownBgHover: "hover:opacity-90" },
};

const SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef(({ className, variant = "default", size = "md", ...props }, ref) => {
  const v = VARIANTS[variant] || VARIANTS.default;
  const ownBackground = hasBackgroundClass(className);
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        SIZES[size] || SIZES.md,
        v.base,
        ownBackground ? v.ownBgHover : v.bg,
        className
      )}
      {...props}
    />
  );
});

Button.displayName = "Button";
