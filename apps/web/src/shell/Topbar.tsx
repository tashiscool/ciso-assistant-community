import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Search, LogOut, Menu, Settings, SlidersHorizontal, User as UserIcon } from 'lucide-react';
import { ApiClient } from '../shared/api/client';
import { canUseHeaderIdentity, resetEdgeIdentity, useEdgeIdentity } from '../shared/session/identity';
import type { WorkspaceUser } from '../features/iam/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../lib/utils';
import type { ShellAccessProfile } from './shellAccess';

const client = new ApiClient();

type TopbarProps = {
  sessionReady: boolean;
  sessionSyncing: boolean;
  access: ShellAccessProfile;
  profileName?: string | null;
  profileEmail?: string | null;
  onOpenNavigation?: () => void;
};

/** Map route segments to human-readable breadcrumb labels. */
const ROUTE_LABELS: Record<string, string> = {
  '': 'Home',
  program: 'Program',
  'quick-start': 'Guided Setup',
  analytics: 'Analytics',
  search: 'Search',
  setup: 'Setup',
  workspace: 'Workspace',
  me: 'My Access',
  domains: 'Domains',
  team: 'Team',
  access: 'Permissions',
  libraries: 'Libraries',
  frameworks: 'Frameworks',
  assessments: 'Assessments',
  'security-profiles': 'Security Profiles',
  'threat-models': 'Threat Models',
  'risk-scenarios': 'Risk Scenarios',
  'third-party': 'Third Party',
  privacy: 'Privacy',
  resilience: 'Resilience',
  reports: 'Reports',
  chat: 'Chat',
  imports: 'Imports',
  portal: 'External Portal',
  'advanced-risk': 'Advanced Risk',
  ebios: 'EBIOS RM',
  quantitative: 'Quantitative',
  conmon: 'ConMon',
  profiles: 'Profiles',
  executions: 'Runs',
  evidence: 'Evidence',
  'evidence-management': 'Evidence Workspace',
  sources: 'Sources',
  jobs: 'Jobs',
  assurance: 'Assurance',
  tracker: 'Tracker',
  packages: 'Packages',
  reviews: 'Reviews',
  'agent-runs': 'Agent Runs',
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Home', href: '/' }];
  }

  return segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));
}

function getInitials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Topbar({ sessionReady, sessionSyncing, access, profileName, profileEmail, onOpenNavigation }: TopbarProps) {
  const { identity, authMode, setIdentity, setAuthMode } = useEdgeIdentity();
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState(identity.tenantId);
  const [userId, setUserId] = useState(identity.userId);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasNotification] = useState(true);
  const [previewToolsOpen, setPreviewToolsOpen] = useState(false);

  const breadcrumbs = useBreadcrumbs();
  const showIdentityControls = access.canViewAdminNavigation && (canUseHeaderIdentity() || authMode === 'headers');

  useEffect(() => {
    setTenantId(identity.tenantId);
    setUserId(identity.userId);
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    void (async () => {
      if (!sessionReady || authMode === 'anonymous' || !showIdentityControls) {
        setUsers([]);
        setLoadError(null);
        return;
      }

      try {
        setLoadError(null);
        const response = await client.get<{ data: WorkspaceUser[] }>('/iam/users');
        setUsers(response.data);
      } catch (err) {
        setUsers([]);
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();
  }, [authMode, identity.tenantId, identity.userId, sessionReady, showIdentityControls]);

  const currentUser = users.find((u) => u.id === userId);
  const displayName = profileName?.trim() || currentUser?.displayName || userId || 'User';
  const displayEmail = profileEmail?.trim() || currentUser?.email || '';
  const initials = getInitials(displayName);
  const settingsTarget = access.canViewInternalTools
    ? '/settings'
    : access.canViewAdminNavigation
      ? '/setup/general'
      : null;
  const settingsLabel = access.canViewInternalTools ? 'Platform settings' : 'Workspace settings';

  function applyIdentityChange(nextTenantId: string, nextUserId: string) {
    if (nextTenantId === identity.tenantId && nextUserId === identity.userId) {
      return;
    }

    if (canUseHeaderIdentity()) {
      setAuthMode('headers');
    }
    setIdentity({ tenantId: nextTenantId, userId: nextUserId });
  }

  function handleApplyIdentity() {
    applyIdentityChange(tenantId, userId);
  }

  function handleResetPreviewIdentity() {
    const nextIdentity = resetEdgeIdentity('headers');
    setIdentity(nextIdentity);
    setTenantId(nextIdentity.tenantId);
    setUserId(nextIdentity.userId);
    setPreviewToolsOpen(false);
  }

  async function handleSignOut() {
    try {
      await fetch('/_api/core/session', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {}

    const nextIdentity = resetEdgeIdentity('anonymous');
    setIdentity(nextIdentity);
    setUsers([]);
    setLoadError(null);
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-[#ded7e5] bg-white px-4 text-[#2b0b4d] shadow-[0_1px_0_rgba(43,11,77,0.02)] sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          aria-label="Open navigation"
          className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d8d0de] bg-white text-[#5f536b] shadow-sm transition hover:bg-[#f8f5fa] md:hidden"
          type="button"
          onClick={onOpenNavigation}
        >
          <Menu className="h-4 w-4" />
        </button>
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#958b9d]" />}
            <span
              className={cn(
                'truncate text-sm',
                i === breadcrumbs.length - 1
                  ? 'font-medium text-[#2b0b4d]'
                  : 'text-[#62576a]',
              )}
            >
              {crumb.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showIdentityControls ? (
          <Dialog open={previewToolsOpen} onOpenChange={setPreviewToolsOpen}>
            <DialogTrigger asChild>
              <Button className="hidden lg:inline-flex" size="sm" variant="secondary">
                <SlidersHorizontal className="h-4 w-4" />
                Preview tools
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Loopback preview tools</DialogTitle>
                <DialogDescription>
                  These controls are only for local preview and review. They stay out of the main shell so the product chrome remains focused on normal users.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#6f6578]">Current preview identity</div>
                  <div className="mt-2 text-sm font-medium text-[#241232]">{displayName}</div>
                  <div className="mt-1 text-xs text-[#7a2ed6]">{displayEmail || 'Workspace account'}</div>
                  <div className="mt-3 text-xs text-[#6f6578]">
                    {tenantId} / {userId}
                  </div>
                </div>
                <div className="rounded-3xl border border-[#d8c5ee] bg-[#f8f3ff] px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a2ed6]">Why this is hidden</div>
                  <div className="mt-2 text-sm leading-6 text-[#51465e]">
                    Tenant switching and identity overrides are preview-only mechanics. Regular users should never have to understand them to use Regovise.
                  </div>
                </div>
              </div>

              {loadError ? <div className="notice-warning">{loadError}</div> : null}

              <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                <label className="space-y-2">
                  <span className="text-sm text-[#51465e]">Tenant</span>
                  <Input
                    className="h-10 text-sm"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyIdentity()}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-[#51465e]">User</span>
                  {users.length > 0 ? (
                    <Select value={userId} onValueChange={(val) => setUserId(val)}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.displayName} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-10 text-sm"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyIdentity()}
                    />
                  )}
                </label>
              </div>

              <DialogFooter className="gap-2">
                <Button onClick={handleResetPreviewIdentity} size="sm" type="button" variant="ghost">
                  Reset to demo identity
                </Button>
                <Button
                  onClick={() => {
                    handleApplyIdentity();
                    setPreviewToolsOpen(false);
                  }}
                  size="sm"
                  type="button"
                  variant="default"
                >
                  Switch preview identity
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        {sessionSyncing ? (
          <div className="hidden lg:flex items-center rounded-full border border-[#d8d0de] bg-[#f8f5fa] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#62576a]">
            Syncing session
          </div>
        ) : null}

        {access.canUseSearch ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[#6d6475] hover:bg-[#f4eef8] hover:text-[#2b0b4d]"
            aria-label="Search (Cmd+K)"
            onClick={() => navigate('/search')}
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-[#6d6475] hover:bg-[#f4eef8] hover:text-[#2b0b4d]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {hasNotification && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#22a651]" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-[#f4eef8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d3df2]/40"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">{initials || 'U'}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-[#2b0b4d] leading-none">{displayName}</div>
                <div className="mt-0.5 text-[10px] text-[#62576a] leading-none truncate max-w-[140px]">
                  {displayEmail || 'Workspace account'}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex-col items-start gap-0.5 cursor-default focus:bg-transparent">
              <span className="text-xs text-[#6f6578]">Signed in as</span>
              <span className="text-xs text-[#7a2ed6] truncate w-full">{displayName}</span>
            </DropdownMenuItem>
            {displayEmail ? (
              <DropdownMenuItem className="flex-col items-start gap-0.5 cursor-default focus:bg-transparent">
                <span className="text-xs text-[#6f6578]">Email</span>
                <span className="text-xs text-[#7a2ed6] truncate w-full">{displayEmail}</span>
              </DropdownMenuItem>
            ) : null}
            {showIdentityControls ? (
              <DropdownMenuItem className="flex-col items-start gap-0.5 cursor-default focus:bg-transparent">
                <span className="text-xs text-[#6f6578]">Debug identity</span>
                <span className="font-mono text-xs text-[#7a2ed6] truncate w-full">
                  {tenantId} / {userId}
                </span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/workspace/me')}>
              <UserIcon className="h-4 w-4 text-[#6f6578]" />
              Profile
            </DropdownMenuItem>
            {settingsTarget ? (
              <DropdownMenuItem onSelect={() => navigate(settingsTarget)}>
                <Settings className="h-4 w-4 text-[#6f6578]" />
                {settingsLabel}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[#b72535] focus:text-[#9d1f2c] focus:bg-[#fff0f2]"
              onSelect={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
