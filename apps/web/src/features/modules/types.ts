export type ModuleImplementationType =
  | 'shared-workspace'
  | 'dedicated-workspace'
  | 'template-workspace'
  | 'subfeature';

export type ModuleSeedFieldDefinition = {
  displayName: string;
  systemName: string;
  fieldType:
    | 'Text Field'
    | 'Text Area'
    | 'Date'
    | 'Whole Number'
    | 'Dollar'
    | 'Select'
    | 'Risk Probability'
    | 'Risk Consequence'
    | 'IP Address';
  required?: boolean;
  helpText?: string;
  choices?: string[];
};

export type ModuleCatalogEntry = {
  moduleKey: string;
  moduleName: string;
  pluralName: string;
  description: string;
  implementationType: ModuleImplementationType;
  canonicalRoute: string;
  directRoute: string;
  coverageBadge: string;
  primaryAction: string;
  relatedModules: string[];
  aliases?: string[];
  starterFields?: ModuleSeedFieldDefinition[];
  recordCount?: number;
};

export type ModuleRecordLink = {
  id: string;
  relationType: string;
  targetType: string;
  targetId: string | null;
  label: string;
  route: string | null;
};

export type ModuleRecordActivity = {
  id: string;
  type: 'created' | 'updated' | 'note' | 'archived';
  message: string;
  createdAt: string;
  createdByUserId: string | null;
};

export type ModuleRecord = {
  id: string;
  moduleKey: string;
  folderId: string;
  title: string;
  status: string;
  ownerUserId: string | null;
  assigneeUserId: string | null;
  startOn: string | null;
  finishOn: string | null;
  dueOn: string | null;
  reviewOn: string | null;
  expiresOn: string | null;
  data: Record<string, unknown>;
  links: ModuleRecordLink[];
  activity: ModuleRecordActivity[];
  archived: boolean;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModuleCatalogResponse = {
  modules: ModuleCatalogEntry[];
};

export type ModuleRecordsResponse = {
  module: ModuleCatalogEntry;
  records: ModuleRecord[];
};

export type SaveModuleRecordInput = {
  folderId: string;
  title?: string | null;
  status?: string | null;
  ownerUserId?: string | null;
  assigneeUserId?: string | null;
  startOn?: string | null;
  finishOn?: string | null;
  dueOn?: string | null;
  reviewOn?: string | null;
  expiresOn?: string | null;
  data?: Record<string, unknown>;
  links?: ModuleRecordLink[];
  note?: string | null;
};

export const SHARED_MODULE_ALIAS_ROUTES: Array<{ moduleKey: string; route: string }> = [
  { moduleKey: 'assets', route: '/assets' },
  { moduleKey: 'capabilities', route: '/capabilities' },
  { moduleKey: 'case-management', route: '/case-management' },
  { moduleKey: 'causal-analysis', route: '/causal-analysis' },
  { moduleKey: 'changes', route: '/changes' },
  { moduleKey: 'components', route: '/components' },
  { moduleKey: 'data-calls', route: '/data-calls' },
  { moduleKey: 'evidence-locker', route: '/evidence-locker' },
  { moduleKey: 'exceptions', route: '/security-exceptions' },
  { moduleKey: 'incidents', route: '/incidents' },
  { moduleKey: 'interconnections', route: '/interconnections' },
  { moduleKey: 'issues', route: '/issues' },
  { moduleKey: 'policies', route: '/policies' },
  { moduleKey: 'programs', route: '/programs' },
  { moduleKey: 'projects', route: '/projects' },
  { moduleKey: 'requests', route: '/requests' },
  { moduleKey: 'requirements', route: '/requirements' },
  { moduleKey: 'risks', route: '/risks' },
  { moduleKey: 'security-controls', route: '/security-controls' },
  { moduleKey: 'security-plans', route: '/security-plans' },
  { moduleKey: 'supply-chain', route: '/supply-chain' },
  { moduleKey: 'tasks', route: '/tasks' },
  { moduleKey: 'threats', route: '/threats' },
];

export const MODULE_DIRECTORY_ROUTES = [
  '/modules',
  ...SHARED_MODULE_ALIAS_ROUTES.map((entry) => entry.route),
  '/assessment-plans',
  '/questionnaires',
  '/catalogues',
  '/security-profiles',
  '/threat-models',
] as const;
