import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import React, { type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

// Adapted from the shadcn New York primitive for Shipboard's theme and touch targets.
const buttonVariants = cva(
  'button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60',
  {
    variants: {
      tone: {
        primary: 'primary',
        secondary: '',
        quiet: 'border-transparent bg-transparent',
      },
    },
    defaultVariants: { tone: 'secondary' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tone, className, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ tone }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
