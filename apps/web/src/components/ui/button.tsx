import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b35e6]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[#8b35e6] text-white shadow-sm hover:bg-[#742bc2]',
        destructive:
          'border border-[#f2b7bf] bg-[#fff0f2] text-[#9d1f2c] hover:bg-[#ffe2e5]',
        outline:
          'border border-[#cfc7d8] bg-white text-[#2b173d] shadow-sm hover:bg-[#f6f1fa]',
        secondary:
          'border border-[#ded8e4] bg-[#fbf9fc] text-[#2b173d] hover:bg-[#f2edf6]',
        ghost:
          'text-[#4f435c] hover:bg-[#f2edf6] hover:text-[#241232]',
        link:
          'text-[#6f20c9] underline-offset-4 hover:text-[#4f148f] hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
