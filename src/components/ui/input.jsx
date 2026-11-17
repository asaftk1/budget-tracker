import * as React from "react";
import { cn } from '../../lib/utils';

// Heights follow the Button sizes. The prop is called inputSize because the native size
// attribute of <input> already exists.
const SIZES = {
  sm: "h-8 px-2.5 text-sm",
  md: "h-10 px-3 text-base sm:text-sm", // 16px on phones keeps iOS from zooming on focus
  lg: "h-12 px-4 text-base",
};

// invalid sets aria-invalid, and aria-invalid="true" (also set by callers directly) draws the
// error border and ring.
export const Input = React.forwardRef(({ className, inputSize = "md", invalid, ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    aria-invalid={invalid ? "true" : props["aria-invalid"]}
    className={cn(
      "flex w-full rounded-control border border-input bg-background",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger",
      "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
      SIZES[inputSize] || SIZES.md,
      className
    )}
  />
));

Input.displayName = "Input";
