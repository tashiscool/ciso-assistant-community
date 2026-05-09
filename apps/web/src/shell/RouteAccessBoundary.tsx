import { Link, useLocation } from 'react-router-dom';

type RouteAccessBoundaryVariant = 'standard' | 'admin' | 'internal';

type RouteAccessBoundaryProps = {
  fallback: string;
  variant?: RouteAccessBoundaryVariant;
};

function describeVariant(variant: RouteAccessBoundaryVariant) {
  switch (variant) {
    case 'admin':
      return {
        eyebrow: 'Administrator only',
        title: 'This area is limited to workspace administrators.',
        description:
          'Regovise keeps setup, governance, and administrative controls behind the accounts that are responsible for running the workspace.',
      };
    case 'internal':
      return {
        eyebrow: 'Internal tools',
        title: 'This area is reserved for internal platform workflows.',
        description:
          'Platform and diagnostic surfaces stay out of the normal product flow so regular users do not end up inside tooling they are not meant to manage.',
      };
    default:
      return {
        eyebrow: 'Route access',
        title: 'This area is not available for the current account.',
        description:
          'Regovise is keeping this session inside the product surfaces that belong to the current role and domain scope.',
      };
  }
}

function humanizePath(pathname: string) {
  const cleaned = pathname.replace(/^\/+|\/+$/g, '');
  if (!cleaned) {
    return 'Home';
  }

  const firstSegment = cleaned.split('/')[0] ?? cleaned;
  return firstSegment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function RouteAccessBoundary({ fallback, variant = 'standard' }: RouteAccessBoundaryProps) {
  const location = useLocation();
  const copy = describeVariant(variant);
  const requestedPath = `${location.pathname}${location.search}${location.hash}`;
  const fallbackRoute = fallback.startsWith('/') ? fallback : '/';
  const showSecondaryAction = fallbackRoute !== '/';

  return (
    <section className="panel max-w-3xl">
      <div className="eyebrow">{copy.eyebrow}</div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{copy.description}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Requested area</div>
          <div className="mt-2 text-base font-semibold text-white">{humanizePath(location.pathname)}</div>
          <div className="mt-2 break-all text-xs text-slate-500">{requestedPath}</div>
        </div>
        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.04] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">Suggested next step</div>
          <div className="mt-2 text-base font-semibold text-white">
            {showSecondaryAction ? humanizePath(fallbackRoute) : 'Home'}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-300">
            Use a route that fits the current role instead of trying to work around the access boundary.
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="button-primary" to="/">
          Open home
        </Link>
        {showSecondaryAction ? (
          <Link className="button-secondary" to={fallbackRoute}>
            Open recommended area
          </Link>
        ) : null}
        <Link className="button-secondary" to="/workspace/me">
          Review my access
        </Link>
      </div>
    </section>
  );
}
