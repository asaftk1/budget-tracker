import React from "react";
import { cn } from '../../lib/utils';

export const Card = ({ className, ...props }) => (
  <div className={cn("rounded-xl border bg-card text-card-foreground shadow", className)} {...props} />
);

export const CardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  // Content arrives through props (children); the linter cannot see it through the spread.
  // eslint-disable-next-line jsx-a11y/heading-has-content
  <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);