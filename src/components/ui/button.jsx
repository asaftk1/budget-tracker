import * as React from "react";
import { cn } from '../../lib/utils';

export const Button = React.forwardRef(({ className, ...props }, ref) => (
  <button ref={ref} className={cn("inline-flex items-center justify-center rounded-md bg-primary text-white px-4 py-2", className)} {...props} />
));

Button.displayName = "Button";