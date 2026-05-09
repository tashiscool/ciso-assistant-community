export type AgentWorkflowActionCategory =
  | 'observe'
  | 'plan'
  | 'parse'
  | 'classify'
  | 'normalize'
  | 'evaluate'
  | 'map'
  | 'package'
  | 'report'
  | 'reconcile'
  | 'validate'
  | 'explain'
  | 'draft';

export type AgentWorkflowTaskDef = {
  taskId: string;
  description: string;
  actionCategory: AgentWorkflowActionCategory;
  actionId: string;
  dependsOn: string[];
  optional?: boolean;
};

export type AgentWorkflowGraph = {
  workflowName: string;
  rationale: string;
  notes: Record<string, unknown>;
  tasks: AgentWorkflowTaskDef[];
};

export type AgentWorkflowMemory = {
  workflowName: string;
  startedAt: string;
  globals: Record<string, unknown>;
  perTask: Record<
    string,
    {
      inputs?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
      artifacts?: Array<{ name: string; path: string }>;
    }
  >;
};

function nowIso(): string {
  return new Date().toISOString();
}

function coerce(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => coerce(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, coerce(item)]),
    );
  }
  return value;
}

export function createWorkflowMemory(args: {
  workflowName: string;
  globals?: Record<string, unknown>;
}): AgentWorkflowMemory {
  return {
    workflowName: args.workflowName,
    startedAt: nowIso(),
    globals: Object.fromEntries(
      Object.entries(args.globals ?? {}).map(([key, value]) => [key, coerce(value)]),
    ),
    perTask: {},
  };
}

export function recordWorkflowTaskInputs(
  memory: AgentWorkflowMemory,
  taskId: string,
  inputs: Record<string, unknown>,
): void {
  memory.perTask[taskId] = {
    ...(memory.perTask[taskId] ?? {}),
    inputs: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, coerce(value)])),
  };
}

export function recordWorkflowTaskOutputs(
  memory: AgentWorkflowMemory,
  taskId: string,
  outputs: Record<string, unknown>,
): void {
  memory.perTask[taskId] = {
    ...(memory.perTask[taskId] ?? {}),
    outputs: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, coerce(value)])),
  };
}

export function recordWorkflowTaskArtifact(
  memory: AgentWorkflowMemory,
  taskId: string,
  name: string,
  path: string,
): void {
  const current = memory.perTask[taskId] ?? {};
  const artifacts = current.artifacts ?? [];
  artifacts.push({
    name,
    path,
  });
  memory.perTask[taskId] = {
    ...current,
    artifacts,
  };
}

export function validateWorkflowGraph(graph: AgentWorkflowGraph): AgentWorkflowTaskDef[] {
  const byId = new Map(graph.tasks.map((task) => [task.taskId, task]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: AgentWorkflowTaskDef[] = [];

  function visit(task: AgentWorkflowTaskDef) {
    if (visited.has(task.taskId)) {
      return;
    }
    if (visiting.has(task.taskId)) {
      throw new Error(`Cycle detected in agent workflow graph at ${task.taskId}.`);
    }
    visiting.add(task.taskId);
    for (const dependencyId of task.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(`Unknown dependency ${dependencyId} from agent workflow task ${task.taskId}.`);
      }
      visit(dependency);
    }
    visiting.delete(task.taskId);
    visited.add(task.taskId);
    ordered.push(task);
  }

  for (const task of graph.tasks) {
    visit(task);
  }

  return ordered;
}

export function buildObservableAssuranceWorkflow(args: {
  bundleKind: string;
  failingEvaluations: number;
  openGaps: number;
  threatHuntFindingCount: number;
  requestedWritebacks: boolean;
}): AgentWorkflowGraph {
  const threatHuntRequired =
    args.bundleKind === 'threat-hunt' || args.threatHuntFindingCount > 0;

  const tasks: AgentWorkflowTaskDef[] = [
    {
      taskId: 'observe_bundle',
      description: 'Load the bounded evidence snapshot and summarize the operating context.',
      actionCategory: 'observe',
      actionId: 'observe.bundle_snapshot',
      dependsOn: [],
    },
    {
      taskId: 'plan_assurance_path',
      description: 'Select the bounded assurance playbook and expected review gates.',
      actionCategory: 'plan',
      actionId: 'plan.assurance_path',
      dependsOn: ['observe_bundle'],
    },
    {
      taskId: 'evaluate_assurance',
      description: 'Run deterministic assurance evaluations against the normalized bundle.',
      actionCategory: 'evaluate',
      actionId: 'evaluate.deterministic_assurance',
      dependsOn: ['plan_assurance_path'],
    },
    {
      taskId: 'evaluate_threat_hunt',
      description: 'Run bounded threat-hunt derivation over exposure, telemetry, and remediation chains.',
      actionCategory: 'evaluate',
      actionId: 'evaluate.threat_hunt_findings',
      dependsOn: ['evaluate_assurance'],
      optional: !threatHuntRequired,
    },
    {
      taskId: 'map_gaps',
      description: 'Map failing results into review recommendations and POA&M-oriented follow-up.',
      actionCategory: 'map',
      actionId: 'map.gaps_to_recommendations',
      dependsOn: ['evaluate_assurance'],
    },
    {
      taskId: 'build_package',
      description: 'Build the FedRAMP 20x package and canonical evidence links.',
      actionCategory: 'package',
      actionId: 'package.fedramp20x_bundle',
      dependsOn: ['map_gaps', 'evaluate_threat_hunt'],
    },
    {
      taskId: 'render_reports',
      description: 'Render assessor, executive, and AO-facing report bundles.',
      actionCategory: 'report',
      actionId: 'report.render_audience_bundles',
      dependsOn: ['build_package'],
    },
    {
      taskId: 'reconcile_package',
      description: 'Reconcile package artifacts against deterministic source state.',
      actionCategory: 'reconcile',
      actionId: 'reconcile.machine_human_views',
      dependsOn: ['render_reports'],
    },
    {
      taskId: 'validate_package',
      description: 'Validate package schema and narrative contract before downstream handoff.',
      actionCategory: 'validate',
      actionId: 'validate.package_contracts',
      dependsOn: ['reconcile_package'],
    },
    {
      taskId: 'draft_writebacks',
      description: 'Draft approval-gated external writebacks without dispatching them automatically.',
      actionCategory: 'draft',
      actionId: 'draft.external_writebacks',
      dependsOn: ['validate_package'],
      optional: !args.requestedWritebacks,
    },
    {
      taskId: 'explain_run',
      description: 'Explain the run, review gates, and policy outcomes in a bounded summary.',
      actionCategory: 'explain',
      actionId: 'explain.run_trace',
      dependsOn: ['draft_writebacks'],
    },
  ];

  const rationale = `Bundle kind ${args.bundleKind} with ${args.failingEvaluations} failing evaluations, ${args.openGaps} open gaps, and ${args.threatHuntFindingCount} threat-hunt findings.`;

  return {
    workflowName: 'observable-assurance-agent',
    rationale,
    notes: {
      threatHuntRequired,
      requestedWritebacks: args.requestedWritebacks,
      failingEvaluations: args.failingEvaluations,
      openGaps: args.openGaps,
    },
    tasks: validateWorkflowGraph({
      workflowName: 'observable-assurance-agent',
      rationale,
      notes: {},
      tasks,
    }),
  };
}
