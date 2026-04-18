import { ApiClient } from '../../shared/api/client';

const client = new ApiClient();

export type WorkbenchSnapshot = {
  metrics: {
    activeItems: number;
    actionNeeded: number;
    dueSoon: number;
    completedItems: number;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  items: Array<{
    id: string;
    title: string;
    module: string;
    status: string;
    owner: string;
    priority: string;
    dueDate: string | null;
    route: string;
    summary: string;
    lastActivity: string;
    progress: number;
  }>;
  completedItems: Array<{
    id: string;
    title: string;
    module: string;
    status: string;
    owner: string;
    priority: string;
    dueDate: string | null;
    route: string;
    summary: string;
    lastActivity: string;
    progress: number;
  }>;
  activity: Array<{
    bucket: string;
    active: number;
    completed: number;
    attention: number;
  }>;
  moduleVolume: Array<{
    module: string;
    count: number;
  }>;
};

export type NewsFeedSnapshot = {
  metrics: {
    totalEvents: number;
    actionNeeded: number;
    workflowEvents: number;
    activeModules: number;
  };
  events: Array<{
    id: string;
    title: string;
    module: string;
    type: string;
    priority: string;
    status: string;
    summary: string;
    route: string;
    occurredAt: string;
    actor: string | null;
  }>;
  timeline: Array<{
    bucket: string;
    events: number;
    workflow: number;
    action: number;
  }>;
  moduleVolume: Array<{
    module: string;
    count: number;
  }>;
};

export type WorkflowControlSnapshot = {
  metrics: {
    activeLeases: number;
    runningFlows: number;
    awaitingReview: number;
    completed: number;
  };
  activeLeases: Array<{
    leaseKey: string;
    acquiredAt: string;
    expiresAt: string;
    metadata: Record<string, unknown> | null;
  }>;
  templates: Array<{
    id: string;
    title: string;
    module: string;
    activeCount: number;
    detail: string;
    route: string;
  }>;
  lanes: Array<{
    id: string;
    label: string;
    count: number;
    detail: string;
  }>;
  recentRuns: Array<{
    id: string;
    title: string;
    module: string;
    status: string;
    detail: string;
    updatedAt: string;
    route: string;
  }>;
};

export type UtilitiesControlSnapshot = {
  metrics: {
    totalUtilities: number;
    recentRuns: number;
    previewReady: number;
    queuedRuns: number;
  };
  utilities: Array<{
    key: string;
    title: string;
    status: string;
    module: string;
    description: string;
    route: string;
    dryRunSupport: boolean;
    queueName: string;
    receiptPath: string;
    notes: string;
    runCount: number;
    lastRun: string | null;
  }>;
  recentRuns: Array<{
    id: string;
    utilityKey: string;
    title: string;
    module: string;
    scope: string;
    records: number;
    status: string;
    previewMode: boolean;
    receiptPath: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type SubsystemsControlSnapshot = {
  metrics: {
    totalSubsystems: number;
    pinned: number;
    activeRecordTypes: number;
    openedSessions: number;
  };
  activeSelection: {
    subsystemKey: string | null;
    recordType: string;
    updatedAt: string | null;
  };
  subsystems: Array<{
    key: string;
    title: string;
    category: string;
    description: string;
    route: string;
    usageExample: string;
    dataContract: string;
    actions: string[];
    availability: Record<'Security Plan' | 'Issue' | 'Risk' | 'Evidence', 'Yes' | 'Optional' | 'No'>;
    pinned: boolean;
    openCount: number;
    lastOpenedAt: string | null;
    activityNote: string | null;
  }>;
};

export type RMFControlSnapshot = {
  metrics: {
    packages: number;
    inFlightSteps: number;
    blockedItems: number;
    authorizeReady: number;
  };
  packages: Array<{
    id: string;
    name: string;
    systemCategory: string;
    authorizationBoundary: string;
    currentState: string;
    authorizationStatus: string;
    progress: number;
    blockers: string[];
    nextHandoff: string;
    decisionTarget: string;
    steps: Array<{
      id: string;
      name: string;
      status: 'Completed' | 'In Progress' | 'Planned' | 'Blocked';
      progress: number;
      owner: string;
      summary: string;
      detail: string;
      route: string;
      artifacts: string[];
    }>;
    artifacts: Array<{
      id: string;
      title: string;
      module: string;
      step: string;
      owner: string;
      status: string;
      helper: string;
    }>;
    timeline: Array<{
      bucket: string;
      progress: number;
      artifacts: number;
      findings: number;
    }>;
    updatedAt: string;
    route: string;
  }>;
};

export type AppManagementControlSnapshot = {
  metrics: {
    apps: number;
    groups: number;
    users: number;
    serviceAccounts: number;
  };
  apps: Array<{
    id: string;
    name: string;
    description: string;
    administrators: string[];
    defaultPublic: boolean;
    inheritParentAccess: boolean;
    defaultUsers: string[];
    defaultGroups: string[];
    groups: Array<{
      name: string;
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
      ssoSync: boolean;
    }>;
    users: Array<{
      email: string;
      groups: string[];
      delegate: string;
      notifications: string;
      accessLogs: string;
    }>;
    serviceAccounts: Array<{
      purpose: string;
      tokenDuration: string;
      adminRequired: boolean;
      crudScope: string;
      status: 'Healthy' | 'Review' | 'Queued';
    }>;
    automationOwner: string;
    automationQueue: string;
    automationHealth: string;
    notes: string;
    updatedAt: string;
  }>;
};

export async function getWorkbenchSnapshot(): Promise<WorkbenchSnapshot> {
  const response = await client.get<{ data: WorkbenchSnapshot }>('/ops/workbench');
  return response.data;
}

export async function getNewsFeedSnapshot(): Promise<NewsFeedSnapshot> {
  const response = await client.get<{ data: NewsFeedSnapshot }>('/ops/news-feed');
  return response.data;
}

export async function getWorkflowControlSnapshot(): Promise<WorkflowControlSnapshot> {
  const response = await client.get<{ data: WorkflowControlSnapshot }>('/ops/workflow');
  return response.data;
}

export async function getUtilitiesControlSnapshot(): Promise<UtilitiesControlSnapshot> {
  const response = await client.get<{ data: UtilitiesControlSnapshot }>('/ops/utilities');
  return response.data;
}

export async function launchUtilityRun(body: {
  utilityKey: string;
  module?: string;
  scope?: string;
  recordsHint?: number;
  previewMode?: boolean;
  notes?: string;
}): Promise<{ run: UtilitiesControlSnapshot['recentRuns'][number]; snapshot: UtilitiesControlSnapshot }> {
  const response = await client.post<{
    data: {
      run: UtilitiesControlSnapshot['recentRuns'][number];
      snapshot: UtilitiesControlSnapshot;
    };
  }>('/ops/utilities/launch', body);
  return response.data;
}

export async function getSubsystemsControlSnapshot(): Promise<SubsystemsControlSnapshot> {
  const response = await client.get<{ data: SubsystemsControlSnapshot }>('/ops/subsystems');
  return response.data;
}

export async function selectSubsystemPanel(body: {
  subsystemKey: string;
  recordType?: string;
}): Promise<SubsystemsControlSnapshot> {
  const response = await client.post<{ data: SubsystemsControlSnapshot }>('/ops/subsystems/select', body);
  return response.data;
}

export async function toggleSubsystemPin(
  subsystemKey: string,
  body?: { pinned?: boolean },
): Promise<SubsystemsControlSnapshot> {
  const response = await client.post<{ data: SubsystemsControlSnapshot }>(
    `/ops/subsystems/${encodeURIComponent(subsystemKey)}/pin`,
    body ?? {},
  );
  return response.data;
}

export async function getRMFControlSnapshot(): Promise<RMFControlSnapshot> {
  const response = await client.get<{ data: RMFControlSnapshot }>('/ops/rmf');
  return response.data;
}

export async function advanceRMFPackageHandoff(packageId: string): Promise<RMFControlSnapshot> {
  const response = await client.post<{ data: RMFControlSnapshot }>(
    `/ops/rmf/packages/${encodeURIComponent(packageId)}/handoff`,
  );
  return response.data;
}

export async function getAppManagementControlSnapshot(): Promise<AppManagementControlSnapshot> {
  const response = await client.get<{ data: AppManagementControlSnapshot }>('/ops/app-management');
  return response.data;
}

export async function createAppManagementApp(body: {
  name?: string;
}): Promise<{ app: AppManagementControlSnapshot['apps'][number] | null; snapshot: AppManagementControlSnapshot }> {
  const response = await client.post<{
    data: {
      app: AppManagementControlSnapshot['apps'][number] | null;
      snapshot: AppManagementControlSnapshot;
    };
  }>('/ops/app-management/apps', body);
  return response.data;
}

export async function saveAppManagementApp(
  appId: string,
  body: {
    name?: string;
    description?: string;
    defaultPublic?: boolean;
    inheritParentAccess?: boolean;
    automationOwner?: string;
    notes?: string | null;
  },
): Promise<{ app: AppManagementControlSnapshot['apps'][number] | null; snapshot: AppManagementControlSnapshot }> {
  const response = await client.put<{
    data: {
      app: AppManagementControlSnapshot['apps'][number] | null;
      snapshot: AppManagementControlSnapshot;
    };
  }>(`/ops/app-management/apps/${encodeURIComponent(appId)}`, body);
  return response.data;
}

export async function duplicateAppManagementApp(
  appId: string,
): Promise<{ app: AppManagementControlSnapshot['apps'][number] | null; snapshot: AppManagementControlSnapshot }> {
  const response = await client.post<{
    data: {
      app: AppManagementControlSnapshot['apps'][number] | null;
      snapshot: AppManagementControlSnapshot;
    };
  }>(`/ops/app-management/apps/${encodeURIComponent(appId)}/duplicate`);
  return response.data;
}

export async function acquireWorkflowLease(body: {
  leaseKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ acquired: boolean; lease: WorkflowControlSnapshot['activeLeases'][number]; snapshot: WorkflowControlSnapshot }> {
  const response = await client.post<{
    data: {
      acquired: boolean;
      lease: WorkflowControlSnapshot['activeLeases'][number];
      snapshot: WorkflowControlSnapshot;
    };
  }>('/ops/workflow/leases', body);
  return response.data;
}

export async function releaseWorkflowLease(
  leaseKey: string,
): Promise<{ released: boolean; leaseKey: string; snapshot: WorkflowControlSnapshot }> {
  const response = await client.post<{
    data: {
      released: boolean;
      leaseKey: string;
      snapshot: WorkflowControlSnapshot;
    };
  }>(`/ops/workflow/leases/${encodeURIComponent(leaseKey)}/release`);
  return response.data;
}
