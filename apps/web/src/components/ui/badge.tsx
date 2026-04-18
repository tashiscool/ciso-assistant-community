import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-cyan-400/10 text-cyan-300 border border-cyan-400/20',
        secondary:
          'bg-slate-500/15 text-slate-300 border border-slate-500/20',
        destructive:
          'bg-rose-500/10 text-rose-300 border border-rose-500/20',
        outline:
          'border border-white/15 text-slate-300',
        success:
          'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
        warning:
          'bg-amber-500/10 text-amber-300 border border-amber-500/20',
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
