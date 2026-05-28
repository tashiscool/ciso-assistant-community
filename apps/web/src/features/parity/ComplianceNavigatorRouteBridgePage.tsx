import { Navigate, useParams } from 'react-router-dom';
import { canAccessShellRoute, getDefaultShellRoute, type ShellAccessProfile } from '../../shell/shellAccess';

type ComplianceNavigatorRouteBridgePageProps = {
  area: 'modules' | 'features' | 'builders' | 'setup' | 'utilities' | 'logs';
  access: ShellAccessProfile;
};

function first(segments: string[]) {
  return segments[0]?.toLowerCase() ?? '';
}

function resolveComplianceNavigatorPath(area: ComplianceNavigatorRouteBridgePageProps['area'], segments: string[]): string {
  if (area === 'logs') {
    return '/setup/logs-utilization';
  }

  const slug = first(segments);

  if (area === 'modules') {
    switch (slug) {
      case 'security-profiles':
        return '/security-profiles';
      case 'threat-models':
        return '/threat-models';
      case 'security-plans':
        return '/security-plans';
      case 'security-controls':
        return '/security-controls';
      case 'assessments':
        return '/assessments';
      case 'assets':
        return '/assets';
      case 'capabilities':
        return '/capabilities';
      case 'case-management':
        return '/case-management';
      case 'causal-analysis':
        return '/causal-analysis';
      case 'changes':
        return '/changes';
      case 'risks':
        return '/risks';
      case 'policies':
        return '/policies';
      case 'issues':
        return '/issues';
      case 'components':
        return '/components';
      case 'data-calls':
        return '/data-calls';
      case 'incidents':
        return '/incidents';
      case 'interconnections':
        return '/interconnections';
      case 'tasks':
        return '/tasks';
      case 'evidence':
      case 'evidence-locker':
        return '/evidence-locker';
      case 'exceptions':
        return '/security-exceptions';
      case 'programs':
        return '/programs';
      case 'projects':
        return '/projects';
      case 'requests':
        return '/requests';
      case 'questionnaires':
        return '/questionnaires';
      case 'assessment-plans':
        return '/assessment-plans';
      case 'requirements':
        return '/requirements';
      case 'supply-chain':
        return '/supply-chain';
      case 'threats':
        return '/threats';
      case 'catalogues':
        return '/catalogues';
      case 'import-regscale-catalogs':
        return '/frameworks';
      default:
        return '/modules';
    }
  }

  if (area === 'features') {
    switch (slug) {
      case 'ai':
        return '/features/regml';
      case 'exports':
        return '/features/compliance-exports';
      case 'automation':
        return '/features/automation-manager';
      case 'continuous-monitoring':
        return '/conmon/profiles';
      case 'risk-management':
        return '/risk-scenarios';
      case 'third-party-risk':
        return '/third-party';
      case 'evidence-management':
        return '/evidence-management';
      default:
        return '/features/regml';
    }
  }

  if (area === 'builders') {
    switch (slug) {
      case 'form':
        return '/builders/form-builder';
      case 'export':
        return '/builders/export-builder';
      case 'report':
        return '/builders/report-builder';
      case 'dashboard':
        return '/builders/dashboard-builder';
      case 'questionnaire':
        return '/builders/questionnaire-builder';
      case 'wayfinder':
        return '/builders/wayfinder-builder';
      default:
        return '/builders/form-builder';
    }
  }

  if (area === 'setup') {
    switch (slug) {
      case 'general':
        return '/setup/general';
      case 'users':
        return '/workspace/team';
      case 'roles':
        return '/workspace/access';
      case 'sso':
        return '/setup/sso';
      case 'security-policies':
        return '/setup/security';
      case 'theming':
        return '/setup/branding';
      case 'email':
        return '/setup/email';
      case 'modules':
        return '/setup/modules-features';
      default:
        return '/setup/general';
    }
  }

  switch (slug) {
    case 'builder':
      return '/utilities';
    case 'categorization':
      return '/setup/classification';
    case 'inheritance':
      return '/libraries';
    case 'control-mapping':
      return '/framework-library';
    case 'deviations':
      return '/security-exceptions';
    case 'recurrence':
      return '/validation-flows';
    default:
      return '/utilities';
  }
}

export function ComplianceNavigatorRouteBridgePage({
  area,
  access,
}: ComplianceNavigatorRouteBridgePageProps) {
  const params = useParams();
  const wildcard = params['*'] ?? '';
  const segments = wildcard.split('/').filter(Boolean);
  const resolvedPath = resolveComplianceNavigatorPath(area, segments);
  const target = canAccessShellRoute(resolvedPath, access) ? resolvedPath : getDefaultShellRoute(access);

  return <Navigate replace to={target} />;
}
