import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/80",
        outline:
          "border border-border bg-background text-foreground shadow-xs hover:bg-muted active:bg-muted/80",
        ghost: "text-foreground hover:bg-muted active:bg-muted/80",
      },
      size: {
        default: "h-10",
        compact: "h-9 min-h-9 px-3",
        icon: "size-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProperties
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...properties
}: ButtonProperties) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...properties}
    />
  );
}

export { buttonVariants };
