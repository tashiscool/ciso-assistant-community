import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Search, ShieldCheck, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';
import { getVisibleIaGroups, type IaNavGroup, type IaNavItem } from './iaNavigation';
import type { ShellAccessProfile } from './shellAccess';

type SidebarProps = {
  access: ShellAccessProfile;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

function isRouteActive(pathname: string, to: string): boolean {
  const canonicalPathname = canonicalizeActivePathname(pathname);

  if (to === '/') {
    return canonicalPathname === '/';
  }

  return canonicalPathname === to || canonicalPathname.startsWith(`${to}/`);
}

function canonicalizeActivePathname(pathname: string): string {
  const exactAliases: Record<string, string> = {
    '/audits': '/assessment-evidence-packages',
    '/controls': '/security-controls',
    '/documents': '/evidence-locker',
    '/fedramp/provider': '/trust-center',
    '/features/compliance-exports': '/compliance-exports',
    '/features/news-feed': '/news-feed',
    '/features/subsystems': '/subsystems',
    '/features/utilities': '/utilities',
    '/features/workbench': '/workbench',
    '/features/workflow': '/workflow',
    '/risk-assessments': '/risk-scenarios',
    '/scrutiny-engine': '/grc-admin/scrutiny-engine',
    '/setup-mfa': '/setup/mfa',
    '/setup/user-management-roles': '/workspace/team',
    '/setup/user-management-roles/mfa': '/setup/mfa',
    '/setup/user-management-roles/roles': '/workspace/access',
    '/sso': '/setup/sso',
    '/users': '/workspace/team',
    '/vendors': '/third-party',
  };

  const prefixAliases: Array<[string, string]> = [
    ['/audits/', '/assessment-evidence-packages/'],
    ['/controls/', '/security-controls/'],
    ['/documents/', '/evidence-locker/'],
    ['/features/compliance-exports/', '/compliance-exports/'],
    ['/features/news-feed/', '/news-feed/'],
    ['/features/subsystems/', '/subsystems/'],
    ['/features/utilities/', '/utilities/'],
    ['/features/workbench/', '/workbench/'],
    ['/features/workflow/', '/workflow/'],
    ['/risk-assessments/', '/risk-scenarios/'],
    ['/setup/user-management-roles/mfa/', '/setup/mfa/'],
    ['/setup/user-management-roles/roles/', '/workspace/access/'],
    ['/setup/user-management-roles/', '/workspace/team/'],
    ['/users/', '/workspace/team/'],
    ['/vendors/', '/third-party/'],
  ];

  if (exactAliases[pathname]) {
    return exactAliases[pathname];
  }

  const prefixMatch = prefixAliases.find(([alias]) => pathname.startsWith(alias));
  if (prefixMatch) {
    const [alias, canonical] = prefixMatch;
    return `${canonical}${pathname.slice(alias.length)}`;
  }

  return pathname;
}

function hasActiveItem(group: IaNavGroup, pathname: string): boolean {
  return group.items.some((item) => isRouteActive(pathname, item.to));
}

function groupFallbackRoute(group: IaNavGroup): string {
  return group.items[0]?.to ?? '/';
}

function ExpandedItem({ item, pathname, closeOnNavigate }: { item: IaNavItem; pathname: string; closeOnNavigate?: () => void }) {
  const Icon = item.icon;
  const routeActive = isRouteActive(pathname, item.to);

  return (
    <NavLink
      aria-current={routeActive ? 'page' : undefined}
      data-active={routeActive ? 'true' : undefined}
      to={item.to}
      onClick={closeOnNavigate}
      className={({ isActive }) =>
        cn(
          'group flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-[14px] leading-5 transition',
          isActive || routeActive
            ? 'bg-[#ece7f0] font-medium text-[#8a35e8]'
            : 'text-[#44275f] hover:bg-white hover:text-[#2b0b4d]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-4 w-4 shrink-0', isActive || routeActive ? 'text-[#9d3df2]' : 'text-[#7c7087]')} strokeWidth={1.8} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function ExpandedNavigation({
  groups,
  openGroupIds,
  pathname,
  toggleGroup,
  closeOnNavigate,
}: {
  groups: IaNavGroup[];
  openGroupIds: Set<string>;
  pathname: string;
  toggleGroup: (groupId: string) => void;
  closeOnNavigate?: () => void;
}) {
  const navigationId = useId();
  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
      <div className="space-y-1">
        {groups.map((group) => {
          const Icon = group.icon;
          const isOpen = openGroupIds.has(group.id);
          const isActive = hasActiveItem(group, pathname);
          const controlsId = `${navigationId}-${group.id}`;

          return (
            <section key={group.id} className="space-y-1">
              <button
                aria-expanded={isOpen}
                aria-controls={controlsId}
                data-active={isActive ? 'true' : undefined}
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[15px] font-medium leading-5 transition',
                  isActive
                    ? 'bg-[#f2eaf9] text-[#2b0b4d]'
                    : 'text-[#2f173f] hover:bg-white',
                )}
              >
                <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-[#9d3df2]' : 'text-[#7b7082]')} strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#62576a] transition', isOpen ? 'rotate-180' : '')} />
              </button>

                <div id={controlsId} hidden={!isOpen} className="ml-5 border-l border-[#dfd7e6] pl-2">
                  {group.items.map((item) => (
                    <ExpandedItem key={item.to} closeOnNavigate={closeOnNavigate} item={item} pathname={pathname} />
                  ))}
                </div>
            </section>
          );
        })}
      </div>
    </nav>
  );
}

function CollapsedNavigation({ groups, pathname }: { groups: IaNavGroup[]; pathname: string }) {
  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
      <div className="space-y-1">
        {groups.map((group) => {
          const Icon = group.icon;
          const isActive = hasActiveItem(group, pathname);

          return (
            <Tooltip key={group.id}>
              <TooltipTrigger asChild>
                <NavLink
                  aria-current={isActive ? 'page' : undefined}
                  data-active={isActive ? 'true' : undefined}
                  to={groupFallbackRoute(group)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md transition',
                    isActive
                      ? 'bg-[#ece7f0] text-[#9d3df2]'
                      : 'text-[#746a7b] hover:bg-white hover:text-[#2b0b4d]',
                  )}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{group.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}

function SidebarChrome({
  collapsed,
  groups,
  pathname,
  openGroupIds,
  setCollapsed,
  toggleGroup,
  closeOnNavigate,
}: {
  collapsed: boolean;
  groups: IaNavGroup[];
  pathname: string;
  openGroupIds: Set<string>;
  setCollapsed?: (collapsed: boolean) => void;
  toggleGroup: (groupId: string) => void;
  closeOnNavigate?: () => void;
}) {
  return (
    <>
      <div className={cn('flex h-[72px] items-center border-b border-[#ded7e5] px-4', collapsed ? 'justify-center' : 'justify-between')}>
        <Link className={cn('flex items-center gap-3', collapsed && 'justify-center')} to="/" onClick={closeOnNavigate}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#efe4ff] text-[#8a35e8]">
            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="font-serif text-[25px] font-semibold leading-none tracking-tight text-[#250640]">Regovise</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="truncate rounded border border-[#d7d1dc] bg-white px-2 py-0.5 text-[11px] font-medium text-[#412057]">
                  Workspace console
                </span>
                <span className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-2 py-0.5 text-[10px] font-semibold text-[#5f1aa8]">
                  Staging
                </span>
              </div>
            </div>
          ) : null}
        </Link>

        {!collapsed && setCollapsed ? (
          <button
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d8d0de] bg-white text-[#6d6475] shadow-sm transition hover:bg-[#f8f5fa]"
            type="button"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {collapsed && setCollapsed ? (
        <button
          aria-label="Expand sidebar"
          className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-md border border-[#d8d0de] bg-white text-[#6d6475] shadow-sm transition hover:bg-[#f8f5fa]"
          type="button"
          onClick={() => setCollapsed(false)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}

      {!collapsed ? (
        <div className="px-3 py-3">
          <Link
            className="flex h-10 items-center gap-2 rounded-full bg-[#e9e3ec] px-3 text-[14px] text-[#5f5468] transition hover:bg-[#e1d9e6]"
            to="/search"
            onClick={closeOnNavigate}
          >
            <Search className="h-4 w-4" strokeWidth={1.8} />
            <span className="flex-1 truncate">Help...</span>
            <span className="text-[12px] text-[#5f5468]">⌘+K</span>
          </Link>
        </div>
      ) : null}

      {collapsed ? (
        <CollapsedNavigation groups={groups} pathname={pathname} />
      ) : (
        <ExpandedNavigation
          closeOnNavigate={closeOnNavigate}
          groups={groups}
          openGroupIds={openGroupIds}
          pathname={pathname}
          toggleGroup={toggleGroup}
        />
      )}

    </>
  );
}

export function Sidebar({ access, mobileOpen, onMobileOpenChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const groups = useMemo(() => getVisibleIaGroups(access), [access]);
  const location = useLocation();
  const { pathname } = location;
  const previousLocationKey = useRef(location.key);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const activeGroupIds = useMemo(() => groups.filter((group) => hasActiveItem(group, pathname)).map((group) => group.id), [groups, pathname]);
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => new Set(['home', 'starter-guide', 'work-queue', 'compliance']));

  useEffect(() => {
    if (activeGroupIds.length === 0) {
      return;
    }

    setOpenGroupIds((current) => {
      const next = new Set(current);
      activeGroupIds.forEach((groupId) => next.add(groupId));
      return next;
    });
  }, [activeGroupIds]);

  useEffect(() => {
    if (previousLocationKey.current !== location.key) {
      previousLocationKey.current = location.key;
      onMobileOpenChange(false);
    }
  }, [location.key, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktop.matches) onMobileOpenChange(false);
    };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [mobileOpen, onMobileOpenChange]);

  function toggleGroup(groupId: string) {
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col border-r border-[#ded7e5] bg-[#f7f2fa] text-[#2b0b4d] shadow-[1px_0_0_rgba(43,11,77,0.02)] md:flex xl:hidden">
        <SidebarChrome
          collapsed
          groups={groups}
          openGroupIds={openGroupIds}
          pathname={pathname}
          toggleGroup={toggleGroup}
        />
      </aside>

      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#ded7e5] bg-[#f7f2fa] text-[#2b0b4d] shadow-[1px_0_0_rgba(43,11,77,0.02)] transition-all duration-200 xl:flex',
          collapsed ? 'w-[76px]' : 'w-[292px]',
        )}
      >
        <SidebarChrome
          collapsed={collapsed}
          groups={groups}
          openGroupIds={openGroupIds}
          pathname={pathname}
          setCollapsed={setCollapsed}
          toggleGroup={toggleGroup}
        />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#1b1224]/45 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex h-full w-[292px] max-w-[86vw] flex-col border-r border-[#ded7e5] bg-[#f7f2fa] text-[#2b0b4d] shadow-2xl md:hidden"
            onOpenAutoFocus={() => {
              const focused = document.activeElement;
              returnFocusRef.current = focused instanceof HTMLElement && focused !== document.body
                ? focused
                : document.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]');
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
              returnFocusRef.current = null;
            }}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-[#d8d0de] bg-white text-[#6d6475] shadow-sm"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
            <SidebarChrome
              closeOnNavigate={() => onMobileOpenChange(false)}
              collapsed={false}
              groups={groups}
              openGroupIds={openGroupIds}
              pathname={pathname}
              toggleGroup={toggleGroup}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </TooltipProvider>
  );
}
