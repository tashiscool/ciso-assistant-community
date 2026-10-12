import type { ComponentType, HTMLAttributes, ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type PrimitiveTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const pillToneClass: Record<PrimitiveTone, string> = {
  neutral: 'border-[#ded8e4] bg-[#eeeaf2] text-[#51465e]',
  success: 'border-[#9fdfb7] bg-[#ddf7e6] text-[#126b36]',
  warning: 'border-[#f6d48e] bg-[#fff2d9] text-[#8a4d00]',
  danger: 'border-[#f2b7bf] bg-[#ffe2e5] text-[#9d1f2c]',
  info: 'border-[#b9d8fb] bg-[#eaf4ff] text-[#1f5f99]',
  purple: 'border-[#d7c3f1] bg-[#f2e8ff] text-[#5f1aa8]',
};

type RegPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function RegPageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
  ...props
}: RegPageHeaderProps) {
  return (
    <section className={cn('border-b border-[#ded8e4] bg-white px-4 py-5 sm:px-6', className)} {...props}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1 className="mt-1 text-2xl font-semibold text-[#241232] sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#4f435c]">{description}</p>
          ) : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#6f6578]">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type RegTabItem = {
  id: string;
  label: ReactNode;
  count?: ReactNode;
  to?: string;
  active?: boolean;
};

type RegTabsProps = {
  tabs: RegTabItem[];
  onSelect?: (id: string) => void;
  className?: string;
};

export function RegTabs({ tabs, onSelect, className }: RegTabsProps) {
  return (
    <div className={cn('flex min-w-0 overflow-x-auto border-b border-[#ded8e4]', className)} role="tablist">
      {tabs.map((tab) => {
        const content = (
          <>
            <span>{tab.label}</span>
            {tab.count !== undefined ? (
              <span className="rounded-full bg-[#eeeaf2] px-2 py-0.5 text-xs text-[#51465e]">{tab.count}</span>
            ) : null}
          </>
        );
        const tabClass = cn(
          'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition',
          tab.active
            ? 'border-[#8b35e6] text-[#241232]'
            : 'border-transparent text-[#6f6578] hover:border-[#d7c3f1] hover:text-[#241232]',
        );

        if (tab.to) {
          return (
            <Link aria-selected={tab.active} className={tabClass} key={tab.id} role="tab" to={tab.to}>
              {content}
            </Link>
          );
        }

        return (
          <button
            aria-selected={tab.active}
            className={tabClass}
            key={tab.id}
            onClick={() => onSelect?.(tab.id)}
            role="tab"
            type="button"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export function RegFilterBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col items-stretch gap-3 border-b border-[#ded8e4] bg-white px-4 py-4 sm:px-6 lg:flex-row lg:items-center',
        className,
      )}
      {...props}
    />
  );
}

export function RegTableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-lg border border-[#ded8e4] bg-white shadow-[0_1px_2px_rgba(48,24,72,0.06)]',
        className,
      )}
      {...props}
    />
  );
}

type RegStatusPillProps = {
  tone?: PrimitiveTone;
} & HTMLAttributes<HTMLSpanElement>;

export function RegStatusPill({ tone = 'neutral', className, ...props }: RegStatusPillProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', pillToneClass[tone], className)}
      {...props}
    />
  );
}

type RegAction = {
  label: ReactNode;
  onSelect?: () => void;
  to?: string;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ComponentType<{ className?: string }>;
};

type RegActionMenuProps = {
  actions: RegAction[];
  label?: string;
};

export function RegActionMenu({ actions, label = 'Open actions' }: RegActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={label} size="icon" variant="outline">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const className = action.destructive ? 'text-[#9d1f2c] focus:text-[#9d1f2c]' : undefined;
          const content = (
            <>
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{action.label}</span>
            </>
          );

          if (action.to) {
            return (
              <DropdownMenuItem asChild className={className} disabled={action.disabled} key={index}>
                <Link to={action.to}>{content}</Link>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem
              className={className}
              disabled={action.disabled}
              key={index}
              onSelect={() => {
                action.onSelect?.();
              }}
            >
              {content}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type RegModalBaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function RegModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: RegModalBaseProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden p-0', className)}>
        <DialogHeader className="border-b border-[#ded8e4] px-4 py-5 sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[#ded8e4] bg-white px-4 py-4 sm:px-6">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RegRightDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: RegModalBaseProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed !left-0 !right-0 !top-0 flex h-dvh max-h-dvh !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 rounded-none border-y-0 border-r-0 p-0 sm:!left-auto sm:!max-w-[520px] sm:rounded-l-lg',
          className,
        )}
      >
        <DialogHeader className="border-b border-[#ded8e4] px-4 py-5 pr-14 sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[#ded8e4] bg-white px-4 py-4 sm:px-6">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RegMobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: RegModalBaseProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'bottom-0 !left-0 !top-auto flex max-h-[86dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 rounded-b-none rounded-t-lg p-0 sm:!left-[50%] sm:!top-[50%] sm:!max-w-2xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg',
          className,
        )}
      >
        <DialogHeader className="border-b border-[#ded8e4] px-4 py-5 pr-14 sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[#ded8e4] bg-white px-4 py-4 sm:px-6">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RegDrawerCloseButton({ className, ...props }: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label="Close"
      className={cn('inline-flex h-10 w-10 items-center justify-center rounded-md text-[#6f6578] hover:bg-[#f2edf6] hover:text-[#241232]', className)}
      type="button"
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
}
