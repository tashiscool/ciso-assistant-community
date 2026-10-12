import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] transition-colors',
  {
    variants: {
      variant: {
        default:
          'border border-[#d7c3f1] bg-[#f2e8ff] text-[#5f1aa8]',
        secondary:
          'border border-[#ded8e4] bg-[#eeeaf2] text-[#51465e]',
        destructive:
          'border border-[#f2b7bf] bg-[#ffe2e5] text-[#9d1f2c]',
        outline:
          'border border-[#cfc7d8] text-[#4f435c]',
        success:
          'border border-[#9fdfb7] bg-[#ddf7e6] text-[#126b36]',
        warning:
          'border border-[#f6d48e] bg-[#fff2d9] text-[#8a4d00]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
