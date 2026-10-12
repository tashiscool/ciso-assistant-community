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
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#51465e]">{copy.description}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#6f6578]">Requested area</div>
          <div className="mt-2 text-base font-semibold text-[#241232]">{humanizePath(location.pathname)}</div>
          <div className="mt-2 break-all text-xs text-[#6f6578]">{requestedPath}</div>
        </div>
        <div className="rounded-3xl border border-[#d8c5ee] bg-[#f8f3ff] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a2ed6]">Suggested next step</div>
          <div className="mt-2 text-base font-semibold text-[#241232]">
            {showSecondaryAction ? humanizePath(fallbackRoute) : 'Home'}
          </div>
          <div className="mt-2 text-sm leading-6 text-[#51465e]">
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
