import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        success: "bg-green-100 text-green-600 hover:bg-green-500/90",
        "success-reverse": "bg-green-600 text-onyx-white hover:bg-green-700",
        default:
          "bg-background-900 border-border text-text-50 hover:bg-background-900/90",
        "default-reverse":
          "bg-background-50 border-border text-text-900 hover:bg-background-50/90",
        destructive: "bg-red-500 text-text-50 hover:bg-red-500/90",
        "destructive-reverse":
          "bg-background-50 text-red-500 hover:bg-background-50/90",
        outline:
          "border border-background-300 bg-onyx-white hover:bg-background-50 hover:text-text-900",
        create:
          "border border-background-300 dark:bg-white bg-background-50 text-text-700 hover:bg-background-100 hover:text-text-900 transition-colors duration-200 ease-in-out shadow-sm",
        "outline-reverse":
          "border border-background-300 bg-background-900 hover:bg-background-800 hover:text-text-50",
        secondary: "bg-background-100 text-text-900 hover:bg-background-100/80",
        "secondary-reverse":
          "bg-background-900 text-text-100 hover:bg-background-900/80",
        ghost: "hover:bg-background-100 hover:text-text-900",
        "ghost-reverse": "hover:bg-background-800 hover:text-text-50",
        link: "text-text-900 underline-offset-4 hover:underline",
        "link-reverse": "text-text-50 underline-offset-4 hover:underline",
        submit: "bg-green-500 text-inverted hover:bg-green-600/90",
        "submit-reverse":
          "bg-background-50 text-blue-600 hover:bg-background-50/80",
        navigate: "bg-blue-500 text-onyx-white hover:bg-blue-600",
        "navigate-reverse": "bg-onyx-white text-blue-500 hover:bg-blue-50",
        update:
          "border border-background-300 bg-background-100 text-text-900 hover:bg-background-100/80",
        "update-reverse":
          "bg-background-900 text-text-100 hover:bg-background-900/80",
        next: "bg-background-700 text-text-50 hover:bg-background-700/90",
        "next-reverse":
          "bg-background-50 text-text-700 hover:bg-background-50/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-8 px-3 py-1",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
      reverse: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ElementType;
  tooltip?: string;
  reverse?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size = "sm",
      asChild = false,
      icon: Icon,
      tooltip,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const button = (
      <Comp
        className={cn(
          buttonVariants({
            variant,
            size,
            className,
          })
        )}
        ref={ref}
        {...props}
      >
        {Icon && <Icon />}
        {props.children}
      </Comp>
    );

    if (tooltip) {
      return (
        <div className="relative group">
          {button}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-background-800 text-onyx-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {tooltip}
          </div>
        </div>
      );
    }

    return button;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
