import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 dark:focus:ring-neutral-300",
  {
    variants: {
      variant: {
        public:
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-75 dark:border-green-700 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800",
        private:
          "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-75 dark:border-yellow-700 dark:bg-yellow-900 dark:text-yellow-100 dark:hover:bg-yellow-800",
        "auto-sync":
          "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-75 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800",
        agent:
          "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-75 dark:border-orange-700 dark:bg-orange-900 dark:text-neutral-50 dark:hover:bg-orange-700",
        "agent-faded":
          "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-75 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700",
        canceled:
          "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-75 dark:border-gray-700 dark:bg-gray-900 dark:text-neutral-50 dark:hover:bg-gray-850",
        paused:
          "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-75 dark:border-amber-600 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700",
        in_progress:
          "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-75 dark:border-blue-700 dark:bg-blue-900 dark:text-neutral-50 dark:hover:bg-blue-850",
        success:
          "border-green-200 bg-emerald-50 text-green-600 hover:bg-emerald-75 dark:border-green-600 dark:bg-green-900 dark:text-green-50 dark:hover:bg-green-850",
        default:
          "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-75 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-850",
        secondary:
          "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-75 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-850",
        destructive:
          "border-red-200 bg-red-50 text-red-600 hover:bg-red-75 dark:border-red-700 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-850",
        not_started:
          "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-75 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant,
  color,
  icon: Icon,
  size = "sm",
  circle,
  ...props
}: BadgeProps & {
  icon?: React.ElementType;
  size?: "sm" | "md" | "xs";
  circle?: boolean;
}) {
  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    xs: "px-1.5 py-0.25 text-[.5rem]",
  };

  return (
    <div
      className={cn(badgeVariants({ variant }), sizeClasses[size], className)}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn(
            "mr-1",
            size === "sm" ? "h-3 w-3" : size === "xs" ? "h-2 w-2" : "h-4 w-4"
          )}
        />
      )}
      {circle && (
        <div
          className={cn(
            "mr-2 rounded-full bg-current opacity-80",
            size === "xs" ? "h-2 w-2" : "h-2.5 w-2.5"
          )}
        />
      )}
      {props.children}
    </div>
  );
}

export { Badge, badgeVariants };
