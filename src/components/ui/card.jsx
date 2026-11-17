import React from "react";
import { cn } from '../../lib/utils';

export const Card = ({ className, ...props }) => (
  <div className={cn("rounded-card border bg-card text-card-foreground shadow-card", className)} {...props} />
);

export const CardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  // Content arrives through props (children); the linter cannot see it through the spread.
  // eslint-disable-next-line jsx-a11y/heading-has-content
  <h3 className={cn("text-lg font-semibold leading-tight tracking-tight", className)} {...props} />
);

// A quiet line under or instead of a title (labels of figures, hints).
export const CardDescription = ({ className, ...props }) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
);
