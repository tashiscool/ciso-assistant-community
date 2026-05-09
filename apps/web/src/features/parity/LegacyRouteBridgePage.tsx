import { Navigate, useParams } from 'react-router-dom';
import { canAccessShellRoute, getDefaultShellRoute, type ShellAccessProfile } from '../../shell/shellAccess';

type LegacyRouteBridgePageProps = {
  legacyModel: string;
  access: ShellAccessProfile;
};

type LegacyRouteConfig = {
  resolvePath: (segments: string[]) => string;
};

const LEGACY_ROUTE_CONFIG: Record<string, LegacyRouteConfig> = {
  accreditations: { resolvePath: () => '/accreditations' },
  analytics: { resolvePath: () => '/analytics' },
  actors: { resolvePath: () => '/actors' },
  'asset-assessments': {
    resolvePath: (segments) =>
      segments[0] ? `/resilience/business-impact-analyses/${segments[0]}` : '/asset-assessments',
  },
  assets: { resolvePath: () => '/assets' },
  'auditee-assessments': { resolvePath: (segments) => (segments[0] ? `/portal/assignments/${segments[0]}` : '/portal') },
  'auditee-dashboard': { resolvePath: () => '/portal' },
  'backup-restore': { resolvePath: () => '/backup-restore' },
  'business-impact-analysis': {
    resolvePath: (segments) => (segments[0] ? `/resilience/business-impact-analyses/${segments[0]}` : '/resilience'),
  },
  calendar: { resolvePath: () => '/calendar' },
  'compliance-assessments': {
    resolvePath: (segments) => {
      const [id, subview] = segments;
      if (!id) return '/assessments';
      if (subview === 'action-plan') return `/compliance-assessments/${id}/action-plan`;
      if (subview === 'flash-mode') return `/compliance-assessments/${id}/flash-mode`;
      return `/compliance-assessments/${id}`;
    },
  },
  contracts: { resolvePath: () => '/third-party' },
  dashboards: { resolvePath: () => '/dashboards' },
  'ebios-rm': { resolvePath: (segments) => (segments[0] ? `/advanced-risk/ebios/${segments[0]}` : '/advanced-risk/ebios') },
  entities: { resolvePath: (segments) => (segments[0] ? `/third-party/entities/${segments[0]}` : '/third-party') },
  'entity-assessments': { resolvePath: () => '/third-party' },
  'evidence-revisions': { resolvePath: () => '/evidence/jobs' },
  evidences: { resolvePath: () => '/evidence/jobs' },
  experimental: { resolvePath: () => '/experimental' },
  'findings-assessments': { resolvePath: () => '/findings-assessments' },
  'first-connexion': { resolvePath: () => '/workspace/me' },
  folders: { resolvePath: () => '/workspace/domains' },
  'generic-collections': { resolvePath: () => '/generic-collections' },
  incidents: { resolvePath: () => '/incidents' },
  libraries: { resolvePath: (segments) => (segments[0] ? `/libraries/${segments[0]}` : '/libraries') },
  'license-management': { resolvePath: () => '/license-management' },
  'loaded-libraries': { resolvePath: (segments) => (segments[0] ? `/libraries/${segments[0]}` : '/libraries') },
  login: { resolvePath: () => '/workspace/me' },
  logout: { resolvePath: () => '/workspace/me' },
  'mapping-libraries': { resolvePath: () => '/libraries' },
  'metric-instances': { resolvePath: () => '/metric-instances' },
  'my-assignments': { resolvePath: () => '/portal' },
  'my-profile': { resolvePath: () => '/workspace/me' },
  'operating-modes': { resolvePath: () => '/advanced-risk/ebios' },
  'operational-scenarios': { resolvePath: () => '/advanced-risk/ebios' },
  'password-reset': { resolvePath: () => '/workspace/me' },
  policies: { resolvePath: () => '/policies' },
  'preset-journeys': { resolvePath: () => '/preset-journeys' },
  presets: { resolvePath: () => '/presets' },
  processings: { resolvePath: (segments) => (segments[0] ? `/privacy/processings/${segments[0]}` : '/privacy') },
  'quantitative-risk-hypotheses': {
    resolvePath: (segments) => (segments[0] ? `/quantitative-risk-hypotheses/${segments[0]}` : '/advanced-risk/quantitative'),
  },
  'quantitative-risk-scenarios': {
    resolvePath: (segments) => (segments[0] ? `/quantitative-risk-scenarios/${segments[0]}` : '/advanced-risk/quantitative'),
  },
  'quantitative-risk-studies': {
    resolvePath: (segments) => {
      const [id, subview] = segments;
      if (!id) return '/advanced-risk/quantitative';
      if (subview === 'executive-summary') return `/advanced-risk/quantitative/${id}/executive-summary`;
      if (subview === 'key-metrics') return `/advanced-risk/quantitative/${id}/key-metrics`;
      if (subview === 'action-plan') return `/advanced-risk/quantitative/${id}/action-plan`;
      return `/advanced-risk/quantitative/${id}`;
    },
  },
  'quick-start': { resolvePath: () => '/quick-start' },
  recap: { resolvePath: () => '/recap' },
  reports: { resolvePath: (segments) => (segments[0] === 'dora-roi' ? '/reports/dora-roi' : '/reports') },
  'requirement-assessments': { resolvePath: () => '/requirement-assessments' },
  'requirement-mapping-sets': { resolvePath: () => '/requirement-mapping-sets' },
  'risk-assessments': {
    resolvePath: (segments) => {
      const [id, subview] = segments;
      if (!id) return '/assessments';
      if (subview === 'action-plan' || subview === 'sync-to-actions' || subview === 'export') {
        return `/risk-assessments/${id}/action-plan`;
      }
      if (subview === 'convert-to-quantitative') return `/risk-assessments/${id}/convert-to-quantitative`;
      return `/risk-assessments/${id}`;
    },
  },
  'risk-matrices': { resolvePath: () => '/risk-matrices' },
  'risk-scenarios': { resolvePath: () => '/risk-scenarios' },
  'ro-to': { resolvePath: () => '/advanced-risk/ebios' },
  'scoring-assistant': { resolvePath: () => '/chat' },
  search: { resolvePath: () => '/search' },
  'security-exceptions': { resolvePath: () => '/security-exceptions' },
  settings: { resolvePath: () => '/settings' },
  'setup-mfa': { resolvePath: () => '/setup/security' },
  stakeholders: { resolvePath: () => '/advanced-risk/ebios' },
  'stored-libraries': { resolvePath: (segments) => (segments[0] ? `/libraries/${segments[0]}` : '/libraries') },
  'strategic-scenarios': { resolvePath: () => '/advanced-risk/ebios' },
  sso: { resolvePath: () => '/setup/security' },
  'sync-mappings': { resolvePath: () => '/sync-mappings' },
  'task-nodes': { resolvePath: () => '/task-nodes' },
  'task-templates': { resolvePath: () => '/task-templates' },
  users: { resolvePath: () => '/workspace/team' },
  'validation-flows': { resolvePath: () => '/validation-flows' },
  vulnerabilities: { resolvePath: () => '/vulnerabilities' },
  'x-rays': { resolvePath: () => '/x-rays' },
};

export function LegacyRouteBridgePage({ legacyModel, access }: LegacyRouteBridgePageProps) {
  const params = useParams();
  const wildcard = params['*'] ?? '';
  const segments = wildcard.split('/').filter(Boolean);
  const config = LEGACY_ROUTE_CONFIG[legacyModel];
  const resolvedPath = config?.resolvePath(segments) ?? getDefaultShellRoute(access);
  const target = canAccessShellRoute(resolvedPath, access) ? resolvedPath : getDefaultShellRoute(access);

  return <Navigate replace to={target} />;
}
