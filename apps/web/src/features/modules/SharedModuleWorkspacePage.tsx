import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getFormBuilderModule, listFormBuilderModules } from '../builders/formApi';
import { evaluateFormRuntime, type FormRuntimeResult } from '../builders/formRules';
import type { FormBuilderDetail, FormField, FormSection } from '../builders/formTypes';
import type { WorkspaceFolder } from '../iam/types';
import { ApiClient } from '../../shared/api/client';
import {
  archiveModuleRecord,
  createModuleRecord,
  getModuleCatalogEntry,
  listModuleRecords,
  updateModuleRecord,
} from './api';
import type {
  ModuleCatalogEntry,
  ModuleRecord,
  ModuleRecordLink,
  ModuleSeedFieldDefinition,
  SaveModuleRecordInput,
} from './types';

const client = new ApiClient();

type SharedModuleWorkspacePageProps = {
  fixedModuleKey?: string;
};

type RenderableField = {
  id: string;
  displayName: string;
  systemName: string;
  fieldType: string;
  required: boolean;
  editable: boolean;
  helpText?: string | null;
  choices: string[];
  errors: string[];
};

type RenderableSection = {
  id: string;
  displayName: string;
  fields: RenderableField[];
};

type ModuleDraft = {
  folderId: string;
  status: string;
  data: Record<string, unknown>;
  links: ModuleRecordLink[];
  note: string;
};

const MODULE_WORKSPACE_GUIDANCE: Record<
  string,
  {
    definition: string;
    usageHeading?: string;
    focusAreas: string[];
    relationshipHint: string;
    emptyState: string;
    relationshipPresets?: Array<{
      relationType: string;
      label: string;
      route: string;
    }>;
  }
> = {
  capabilities: {
    definition:
      'Business capabilities are the fundamental abilities, functions, or competencies an organization uses to deliver strategic outcomes.',
    usageHeading: 'Capability management focus',
    focusAreas: [
      'Align capabilities to business outcomes, programs, and objectives.',
      'Track supporting technologies, platforms, and operational dependencies.',
      'Summarize risk rollups, efficiency gaps, and continuous-improvement priorities.',
    ],
    relationshipHint:
      'Use links to connect a capability to programs, projects, risks, assessments, tasks, and enabling components.',
    emptyState:
      'Create the first capability record to map a core organizational function, its strategic outcome, and the technologies or risks that support it.',
    relationshipPresets: [
      { relationType: 'program', label: 'Linked Program', route: '/programs' },
      { relationType: 'project', label: 'Linked Project', route: '/projects' },
      { relationType: 'risk', label: 'Capability Risk', route: '/risks' },
      { relationType: 'assessment', label: 'Capability Assessment', route: '/assessments' },
      { relationType: 'component', label: 'Supporting Component', route: '/components' },
      { relationType: 'task', label: 'Improvement Task', route: '/tasks' },
    ],
  },
  'case-management': {
    definition:
      'Case management is a collaborative process for assessing, investigating, coordinating, and resolving reported non-compliance or adverse events that may create organizational risk.',
    usageHeading: 'Case management focus',
    focusAreas: [
      'Track response and investigation phases from initial reporting through final disposition.',
      'Coordinate evidence, forensic timeline notes, and causal analysis across the case lifecycle.',
      'Summarize risk exposure, legal or policy implications, and corrective actions to prevent recurrence.',
    ],
    relationshipHint:
      'Use links to connect cases to incidents, causal analysis, evidence, risks, tasks, and governing policies.',
    emptyState:
      'Create the first case record to capture intake details, investigative ownership, evidence posture, and the resolution path for a reported issue.',
    relationshipPresets: [
      { relationType: 'incident', label: 'Linked Incident', route: '/incidents' },
      { relationType: 'causal-analysis', label: 'Root Cause Analysis', route: '/causal-analysis' },
      { relationType: 'evidence', label: 'Case Evidence', route: '/evidence-locker' },
      { relationType: 'risk', label: 'Case Risk', route: '/risks' },
      { relationType: 'task', label: 'Response Task', route: '/tasks' },
      { relationType: 'policy', label: 'Related Policy', route: '/policies' },
    ],
  },
  components: {
    definition:
      'Components describe reusable implementation building blocks that support specific controls within a hardware, software, service, policy, process, or procedure context.',
    usageHeading: 'Component management focus',
    focusAreas: [
      'Track component metadata, provider context, and the implementation boundary or security plan the component supports.',
      'Document how the component contributes to control satisfaction, including common-control layering and reusable implementation statements.',
      'Monitor authorization posture, last test dates, and evidence readiness so SSP authors and assessors can reuse the component confidently.',
    ],
    relationshipHint:
      'Use links to connect components to security plans, security controls, capabilities, assessments, evidence, and related interconnections.',
    emptyState:
      'Create the first component record to capture a reusable implementation definition, its supported controls, and its authorization posture.',
    relationshipPresets: [
      { relationType: 'security-plan', label: 'Supported Security Plan', route: '/security-plans' },
      { relationType: 'security-control', label: 'Supported Security Control', route: '/security-controls' },
      { relationType: 'capability', label: 'Grouped Capability', route: '/capabilities' },
      { relationType: 'assessment', label: 'Component Assessment', route: '/assessments' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'interconnection', label: 'Related Interconnection', route: '/interconnections' },
    ],
  },
  'data-calls': {
    definition:
      'Data calls coordinate requests for information, evidence, and pre-read material needed for assessments, regulatory responses, and other compliance matters.',
    usageHeading: 'Data call management focus',
    focusAreas: [
      'Track who must provide the requested material, when it was requested, and when it is due.',
      'Coordinate evidence collection, pre-read objectives, delivery method, and response progress before assessment field work begins.',
      'Maintain an audit-ready trail of what was provided, to whom, and whether the request recurs on a defined cadence.',
    ],
    relationshipHint:
      'Use links to connect data calls to assessments, assessment plans, evidence, tasks, and the plans or controls they support.',
    emptyState:
      'Create the first data call to request pre-read evidence, assign ownership, and track delivery status for an upcoming compliance activity.',
    relationshipPresets: [
      { relationType: 'assessment', label: 'Supported Assessment', route: '/assessments' },
      { relationType: 'assessment-plan', label: 'Assessment Plan', route: '/assessment-plans' },
      { relationType: 'evidence', label: 'Collected Evidence', route: '/evidence-locker' },
      { relationType: 'task', label: 'Follow-up Task', route: '/tasks' },
      { relationType: 'security-plan', label: 'Security Plan Context', route: '/security-plans' },
      { relationType: 'security-control', label: 'Control Context', route: '/security-controls' },
    ],
  },
  'evidence-locker': {
    definition:
      'Evidence Locker is a central repository for storing reusable audit evidence that can support multiple systems, components, and control implementations.',
    usageHeading: 'Evidence locker focus',
    focusAreas: [
      'Maintain one authoritative evidence record with a clear owner, update cadence, and audit-readiness status.',
      'Capture shared-service scope, mapped control coverage, and attestation boundaries so the same evidence can be reused safely.',
      'Track refresh timing, file volume, and evidence quality so assessments and regulators see current material.',
    ],
    relationshipHint:
      'Use links to connect reusable evidence to assessments, data calls, security plans, components, and supported controls.',
    emptyState:
      'Create the first evidence item to capture a reusable artifact, its owner, its refresh cadence, and the systems or controls it supports.',
    relationshipPresets: [
      { relationType: 'assessment', label: 'Supported Assessment', route: '/assessments' },
      { relationType: 'data-call', label: 'Source Data Call', route: '/data-calls' },
      { relationType: 'security-plan', label: 'Supported Security Plan', route: '/security-plans' },
      { relationType: 'component', label: 'Supported Component', route: '/components' },
      { relationType: 'security-control', label: 'Mapped Security Control', route: '/security-controls' },
    ],
  },
  exceptions: {
    definition:
      'Exceptions provide temporary relief for non-compliant requirements or controls while documenting justification, compensating controls, approvals, and expiration management.',
    usageHeading: 'Exception management focus',
    focusAreas: [
      'Capture why the exception is needed, including feasibility constraints and the scope of temporary non-compliance.',
      'Document risk rationale, residual-risk acceptance, compensating controls, and mitigation plans so auditors and approvers can understand the tradeoff.',
      'Track approval state, expiration dates, review points, and renewal or closeout actions before exceptions lapse into audit findings.',
    ],
    relationshipHint:
      'Use links to connect exceptions to risks, controls, policies, evidence, and remediation tasks.',
    emptyState:
      'Create the first exception to capture a temporary control or policy relief request, its justification, and its expiration timeline.',
    relationshipPresets: [
      { relationType: 'risk', label: 'Associated Risk', route: '/risks' },
      { relationType: 'security-control', label: 'Affected Security Control', route: '/security-controls' },
      { relationType: 'policy', label: 'Affected Policy', route: '/policies' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'task', label: 'Mitigation Task', route: '/tasks' },
    ],
  },
  incidents: {
    definition:
      'Incidents are negative events that can jeopardize information, people, or assets and require structured triage, response, investigation, and recovery.',
    usageHeading: 'Incident response focus',
    focusAreas: [
      'Track detection, reporting, severity, and response phase so responders can prioritize and coordinate the immediate response.',
      'Document impact, mitigation actions, evidence, and forensic timeline details as the incident moves through containment and investigation.',
      'Capture recovery, root cause, and closure context so the incident can drive corrective action and reduce recurrence.',
    ],
    relationshipHint:
      'Use links to connect incidents to affected assets, cases, evidence, risks, tasks, and causal analysis.',
    emptyState:
      'Create the first incident to capture a negative event, its severity, the affected system or asset, and the response timeline.',
    relationshipPresets: [
      { relationType: 'asset', label: 'Affected Asset', route: '/assets' },
      { relationType: 'case-management', label: 'Escalated Case', route: '/case-management' },
      { relationType: 'evidence', label: 'Incident Evidence', route: '/evidence-locker' },
      { relationType: 'risk', label: 'Incident Risk', route: '/risks' },
      { relationType: 'task', label: 'Response Task', route: '/tasks' },
      { relationType: 'causal-analysis', label: 'Root Cause Analysis', route: '/causal-analysis' },
    ],
  },
  issues: {
    definition:
      'Issues document findings, deficiencies, POA&Ms, and other non-compliances so teams can coordinate corrective action from discovery through validated closure.',
    usageHeading: 'Issue management focus',
    focusAreas: [
      'Track issue discovery, severity, source, and the affected requirement or policy from initial logging through closure.',
      'Coordinate ownership, due dates, evidence, root-cause detail, and corrective action planning so remediation remains accountable and audit-ready.',
      'Use validation and closure steps to prevent recurrence and turn non-compliances into continuous-improvement actions.',
    ],
    relationshipHint:
      'Use links to connect issues to assessments, policies, requirements, evidence, tasks, risks, and causal analyses.',
    emptyState:
      'Create the first issue to capture a finding, its source, the affected requirement or policy, and the remediation path toward closure.',
    relationshipPresets: [
      { relationType: 'assessment', label: 'Source Assessment', route: '/assessments' },
      { relationType: 'policy', label: 'Affected Policy', route: '/policies' },
      { relationType: 'requirement', label: 'Affected Requirement', route: '/requirements' },
      { relationType: 'evidence', label: 'Issue Evidence', route: '/evidence-locker' },
      { relationType: 'task', label: 'Corrective Action Task', route: '/tasks' },
      { relationType: 'risk', label: 'Related Risk', route: '/risks' },
      { relationType: 'causal-analysis', label: 'Root Cause Analysis', route: '/causal-analysis' },
    ],
  },
  policies: {
    definition:
      'Policies define governing rules, standards, procedures, and guidelines that shape repeatable, enforceable operations across the organization and its third parties.',
    usageHeading: 'Policy management focus',
    focusAreas: [
      'Track document type, governing source, owner, scope, audience, approvals, and effective dates so policies remain current and enforceable.',
      'Capture implementation posture, assessment cadence, attestation timing, and requirement summaries so teams can see how policy expectations translate into operating controls.',
      'Document distribution method, third-party flow-down, and noncompliance tracking so vendors, subcontractors, and internal teams are held to the same governance standard.',
    ],
    relationshipHint:
      'Use links to connect policies to requirements, catalogues, controls, assessments, vendors, evidence, and issue records.',
    emptyState:
      'Create the first policy to capture a governing rule set, its scope, lifecycle dates, implementation posture, and any downstream flow-down or attestation obligations.',
    relationshipPresets: [
      { relationType: 'requirement', label: 'Mapped Requirement', route: '/requirements' },
      { relationType: 'catalogue', label: 'Source Catalogue', route: '/catalogues' },
      { relationType: 'security-control', label: 'Mapped Security Control', route: '/security-controls' },
      { relationType: 'assessment', label: 'Policy Assessment', route: '/assessments' },
      { relationType: 'supply-chain', label: 'Flowed-down Vendor', route: '/third-party' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'issue', label: 'Related Issue', route: '/issues' },
    ],
  },
  requirements: {
    definition:
      'Requirements capture mandatory needs, scope items, and obligations that must be implemented, reviewed, and flowed down across policies, projects, and third parties.',
    usageHeading: 'Requirement management focus',
    focusAreas: [
      'Track requirement type, priority, source, governing law or policy context, owner, and lifecycle status so important obligations remain visible and accountable.',
      'Capture implementation ownership, control mappings, linked records, assessment references, and evidence so teams can show how each requirement is actually being met.',
      'Use review outcomes, noncompliance notes, and third-party acknowledgement tracking to keep requirement implementations current across vendors, subcontractors, and broader initiatives.',
    ],
    relationshipHint:
      'Use links to connect requirements to policies, catalogues, controls, projects, assessments, vendors, evidence, and issue records.',
    emptyState:
      'Create the first requirement to capture its source, owner, implementation posture, and any related policy, project, or vendor flowdown context.',
    relationshipPresets: [
      { relationType: 'policy', label: 'Mapped Policy', route: '/policies' },
      { relationType: 'catalogue', label: 'Source Catalogue', route: '/catalogues' },
      { relationType: 'security-control', label: 'Mapped Security Control', route: '/security-controls' },
      { relationType: 'project', label: 'Linked Project', route: '/projects' },
      { relationType: 'assessment', label: 'Requirement Assessment', route: '/assessments' },
      { relationType: 'supply-chain', label: 'Flowed-down Vendor', route: '/supply-chain' },
      { relationType: 'evidence', label: 'Implementation Evidence', route: '/evidence-locker' },
      { relationType: 'issue', label: 'Related Issue', route: '/issues' },
    ],
  },
  programs: {
    definition:
      'Programs coordinate related activities, projects, and capabilities so organizations can achieve strategic objectives and deliver value to stakeholders.',
    usageHeading: 'Program management focus',
    focusAreas: [
      'Track program type, ownership, strategic alignment, and objective so coordinated work stays tied to enterprise outcomes.',
      'Capture supporting capabilities, technologies, platforms, and resource posture so portfolio coordination is visible across business units.',
      'Summarize milestone progress, stakeholder satisfaction, and risk rollups so leadership can manage value delivery and escalation early.',
    ],
    relationshipHint:
      'Use links to connect programs to capabilities, projects, risks, tasks, assessments, and supporting components.',
    emptyState:
      'Create the first program to capture a strategic initiative, its supporting capabilities, its target outcomes, and its portfolio risk posture.',
    relationshipPresets: [
      { relationType: 'capability', label: 'Linked Capability', route: '/capabilities' },
      { relationType: 'project', label: 'Linked Project', route: '/projects' },
      { relationType: 'risk', label: 'Program Risk', route: '/risks' },
      { relationType: 'task', label: 'Program Task', route: '/tasks' },
      { relationType: 'assessment', label: 'Program Assessment', route: '/assessments' },
      { relationType: 'component', label: 'Supporting Component', route: '/components' },
    ],
  },
  projects: {
    definition:
      'Projects manage discrete scope, budget, schedule, and delivery outcomes within a fixed initiative or investment context.',
    usageHeading: 'Project management focus',
    focusAreas: [
      'Track project type, methodology, parent program, ownership, deliverable accountability, and driver so important initiatives stay tied to strategy and governance.',
      'Capture scope requirements, acceptance criteria, dependencies, budget, percent complete, milestones, and delivery variance so teams can manage the classic scope-cost-schedule constraints.',
      'Summarize risks, quality posture, delivery outcome, and benefits realization so leadership can balance project investments against organizational goals.',
    ],
    relationshipHint:
      'Use links to connect projects to programs, capabilities, requirements, tasks, risks, assessments, and supporting evidence.',
    emptyState:
      'Create the first project to capture its scope, acceptance criteria, dependencies, budget, delivery dates, and the portfolio context it supports.',
    relationshipPresets: [
      { relationType: 'program', label: 'Parent Program', route: '/programs' },
      { relationType: 'capability', label: 'Supported Capability', route: '/capabilities' },
      { relationType: 'requirement', label: 'Project Requirement', route: '/requirements' },
      { relationType: 'task', label: 'Project Task', route: '/tasks' },
      { relationType: 'risk', label: 'Project Risk', route: '/risks' },
      { relationType: 'assessment', label: 'Project Assessment', route: '/assessments' },
      { relationType: 'evidence', label: 'Project Evidence', route: '/evidence-locker' },
    ],
  },
  requests: {
    definition:
      'Requests are formal service submissions that move through a defined workflow from intake through fulfillment while preserving accountability, visibility, and auditability.',
    usageHeading: 'Request management focus',
    focusAreas: [
      'Track request type, intake channel, priority, requestor, fulfiller, approver, and lifecycle status so service work is routed and approved clearly.',
      'Capture requested, approved, needed, and completed dates, service-level targets, milestone checkpoints, and stakeholder visibility so fulfillment timelines stay predictable.',
      'Link requests to issues, risks, assessments, cases, data calls, questionnaires, and parent-child request structures so service delivery stays connected to broader compliance work.',
    ],
    relationshipHint:
      'Use links to connect requests to issues, risks, assessments, cases, data calls, questionnaires, and fulfillment tasks.',
    emptyState:
      'Create the first request to capture a formal service submission, its approval and fulfillment owners, its service target, and any related compliance work.',
    relationshipPresets: [
      { relationType: 'issue', label: 'Related Issue / POA&M', route: '/issues' },
      { relationType: 'risk', label: 'Related Risk', route: '/risks' },
      { relationType: 'assessment', label: 'Related Assessment', route: '/assessments' },
      { relationType: 'case-management', label: 'Related Case', route: '/case-management' },
      { relationType: 'data-call', label: 'Related Data Call', route: '/data-calls' },
      { relationType: 'questionnaire', label: 'Linked Questionnaire', route: '/questionnaires' },
      { relationType: 'task', label: 'Fulfillment Task', route: '/tasks' },
    ],
  },
  tasks: {
    definition:
      'Tasks are discrete assignments, actions, and corrective actions that drive accountability, due-date management, and completion follow-through across the platform.',
    usageHeading: 'Task management focus',
    focusAreas: [
      'Track who assigned the task, who owns it, what related record or workstream it supports, and when it must be completed.',
      'Capture percent complete, recurrence, dependency context, and blocked reasons so routine work and stalled work stay visible.',
      'Document success criteria, review ownership, evidence, and completion outcomes so corrective actions and assignments close out cleanly.',
    ],
    relationshipHint:
      'Use links to connect tasks to issues, assessments, exceptions, changes, risks, incidents, requirements, and supporting evidence.',
    emptyState:
      'Create the first task to assign an owner, due date, and completion objective for a corrective action or standalone assignment.',
    relationshipPresets: [
      { relationType: 'issue', label: 'Related Issue', route: '/issues' },
      { relationType: 'assessment', label: 'Related Assessment', route: '/assessments' },
      { relationType: 'exception', label: 'Related Exception', route: '/security-exceptions' },
      { relationType: 'change', label: 'Related Change', route: '/changes' },
      { relationType: 'risk', label: 'Related Risk', route: '/risks' },
      { relationType: 'incident', label: 'Related Incident', route: '/incidents' },
      { relationType: 'requirement', label: 'Related Requirement', route: '/requirements' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
    ],
  },
  'supply-chain': {
    definition:
      'Supply chain records track vendors, subcontractors, contracts, renewals, assessments, approvals, and requirement flowdown so third-party risk stays visible across the full relationship lifecycle.',
    usageHeading: 'Supply chain management focus',
    focusAreas: [
      'Track vendor type, contract type, service category, contract ownership, value, and lifecycle dates so third-party relationships stay visible and accountable.',
      'Capture vendor risk, assessment cadence, compliance posture, questionnaire activity, and noncompliance tracking so due diligence and remediation stay current.',
      'Manage flowdown obligations, approval posture, and renewal decisions so contracts and subcontractors remain aligned to policy and compliance expectations.',
    ],
    relationshipHint:
      'Use links to connect vendors and contracts to questionnaires, assessments, risks, policies, requirements, tasks, issues, and supporting evidence.',
    emptyState:
      'Create the first supply-chain record to capture a vendor or subcontract, its contract timing, its risk posture, and any flowdown or assessment obligations.',
    relationshipPresets: [
      { relationType: 'questionnaire', label: 'Vendor Questionnaire', route: '/questionnaires' },
      { relationType: 'assessment', label: 'Vendor Assessment', route: '/assessments' },
      { relationType: 'risk', label: 'Third-Party Risk', route: '/risks' },
      { relationType: 'policy', label: 'Flowed-down Policy', route: '/policies' },
      { relationType: 'requirement', label: 'Flowed-down Requirement', route: '/requirements' },
      { relationType: 'task', label: 'Contract Task', route: '/tasks' },
      { relationType: 'issue', label: 'Vendor Issue', route: '/issues' },
      { relationType: 'evidence', label: 'Vendor Evidence', route: '/evidence-locker' },
    ],
  },
  'security-plans': {
    definition:
      'Security plans document the system boundary, implemented and inherited controls, system categorization, authorization posture, and residual-risk context for a regulated information system or service.',
    usageHeading: 'Security plan focus',
    focusAreas: [
      'Track the system boundary, plan ownership, categorization, and mission context so the SSP stays anchored to the actual operational environment.',
      'Capture system categorization, authorization dates, authorizing official, review cadence, and last control assessment timing so approval cycles and expirations remain visible.',
      'Summarize implementation narrative, control inheritance, linked assets or components, and risk-acceptance context so auditors and decision makers can evaluate the boundary consistently.',
    ],
    relationshipHint:
      'Use links to connect security plans to controls, assets, components, assessments, evidence, policies, risks, and supporting data calls.',
    emptyState:
      'Create the first security plan to define an SSP boundary, its authorization posture, its implementation narrative, and the assets or controls it governs.',
    relationshipPresets: [
      { relationType: 'security-control', label: 'Covered Security Control', route: '/security-controls' },
      { relationType: 'asset', label: 'Boundary Asset', route: '/assets' },
      { relationType: 'component', label: 'Boundary Component', route: '/components' },
      { relationType: 'assessment', label: 'Plan Assessment', route: '/assessments' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'policy', label: 'Governing Policy', route: '/policies' },
      { relationType: 'risk', label: 'Boundary Risk', route: '/risks' },
      { relationType: 'data-call', label: 'Assessment Data Call', route: '/data-calls' },
    ],
  },
  interconnections: {
    definition:
      'Interconnections document approved data exchanges between systems so teams understand where data flows, who owns the exchange, and how the boundary is governed over time.',
    usageHeading: 'Interconnection management focus',
    focusAreas: [
      'Track the participating systems, connection method, purpose of exchange, shared data, and exchange frequency across the boundary.',
      'Capture approval authority, data ownership, authentication, transport protection, and least-privilege handling so the exchange remains governed and auditable.',
      'Document downtime impact, availability expectations, and renewal handling so teams understand how outages or changes can affect connected systems over time.',
    ],
    relationshipHint:
      'Use links to connect interconnections to system plans, components, assets, evidence, risks, and supporting tasks.',
    emptyState:
      'Create the first interconnection to document a cross-boundary data exchange, its approval posture, transport protections, and dependency impact.',
    relationshipPresets: [
      { relationType: 'security-plan', label: 'Connected Security Plan', route: '/security-plans' },
      { relationType: 'component', label: 'Connected Component', route: '/components' },
      { relationType: 'asset', label: 'Connected Asset', route: '/assets' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'risk', label: 'Exchange Risk', route: '/risks' },
      { relationType: 'task', label: 'Follow-up Task', route: '/tasks' },
    ],
  },
  changes: {
    definition:
      'Change management coordinates requests for change, impact assessment, approvals, implementation, and post-change review so IT services are updated in a controlled way.',
    usageHeading: 'Change management focus',
    focusAreas: [
      'Track RFC intake, business justification, and expected benefits for each proposed change.',
      'Capture change assessment, risk rating, approval status, and implementation planning before work begins.',
      'Document actual implementation, review outcome, and any rollback or follow-up actions after the change closes.',
    ],
    relationshipHint:
      'Use links to connect change records to incidents, risks, tasks, evidence, cases, and causal-analysis follow-up.',
    emptyState:
      'Create the first change record to manage an RFC, its risk assessment, approval path, implementation plan, and review outcome.',
    relationshipPresets: [
      { relationType: 'task', label: 'Implementation Task', route: '/tasks' },
      { relationType: 'risk', label: 'Change Risk', route: '/risks' },
      { relationType: 'incident', label: 'Related Incident', route: '/incidents' },
      { relationType: 'evidence', label: 'Implementation Evidence', route: '/evidence-locker' },
      { relationType: 'case-management', label: 'Escalated Case', route: '/case-management' },
      { relationType: 'causal-analysis', label: 'Post-Change Analysis', route: '/causal-analysis' },
    ],
  },
  'causal-analysis': {
    definition:
      'Causal analysis uses structured methods to establish cause-and-effect relationships, identify root causes, and eliminate the conditions that created a non-conformance or compliance deficiency.',
    usageHeading: 'Causal analysis focus',
    focusAreas: [
      'Link the analysis to the triggering issue, assessment, incident, or case and document the problem statement clearly.',
      'Capture the chosen analysis method, event timeline, cause type or code, and root-cause conclusion in one place.',
      'Track corrective actions, due dates, and trend signals so the analysis drives permanent improvement instead of one-time containment.',
    ],
    relationshipHint:
      'Use links to connect analyses to cases, incidents, assessments, evidence, risks, change records, and follow-up tasks.',
    emptyState:
      'Create the first causal analysis record to document the non-conformance, investigation method, root cause, and corrective action plan.',
    relationshipPresets: [
      { relationType: 'assessment', label: 'Triggering Assessment', route: '/assessments' },
      { relationType: 'case-management', label: 'Linked Case', route: '/case-management' },
      { relationType: 'incident', label: 'Linked Incident', route: '/incidents' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'task', label: 'Corrective Action Task', route: '/tasks' },
      { relationType: 'risk', label: 'Recurrence Risk', route: '/risks' },
      { relationType: 'change', label: 'Related Change', route: '/changes' },
    ],
  },
  risks: {
    definition:
      'Risks capture situations that could expose the organization to loss, danger, or another negative consequence and help teams evaluate probability, consequence, tolerance, treatment, contingency, and ongoing trend.',
    usageHeading: 'Risk management focus',
    focusAreas: [
      'Track the risk statement, threat context, trigger events, likelihood, impact, and overall level so exposure stays visible and actionable.',
      'Capture treatment strategy, mitigation ownership, tolerance posture, contingency planning, review and approval posture, decision-maker acceptance, residual posture, and review cadence so risk decisions remain accountable.',
      'Use lens scoring, realized-event context, project or control implementation impacts, budgeting notes, and trend snapshots to compare how the risk affects the business over time.',
    ],
    relationshipHint:
      'Use links to connect risks to threats, exceptions, assessments, projects, programs, changes, controls, incidents, evidence, and mitigation tasks.',
    emptyState:
      'Create the first risk to document its source, trigger events, tolerance posture, contingency plan, and review cadence.',
    relationshipPresets: [
      { relationType: 'threat', label: 'Related Threat', route: '/threats' },
      { relationType: 'exception', label: 'Linked Exception', route: '/security-exceptions' },
      { relationType: 'assessment', label: 'Risk Assessment', route: '/assessments' },
      { relationType: 'project', label: 'Affected Project', route: '/projects' },
      { relationType: 'program', label: 'Affected Program', route: '/programs' },
      { relationType: 'change', label: 'Related Change', route: '/changes' },
      { relationType: 'security-control', label: 'Affected Security Control', route: '/security-controls' },
      { relationType: 'incident', label: 'Realized Incident', route: '/incidents' },
      { relationType: 'evidence', label: 'Supporting Evidence', route: '/evidence-locker' },
      { relationType: 'task', label: 'Mitigation Task', route: '/tasks' },
    ],
  },
  threats: {
    definition:
      'Threats capture the people, conditions, warnings, or hazards that could cause damage or danger so teams can triage new threats, analyze vulnerabilities, and drive mitigations over time.',
    usageHeading: 'Threat management focus',
    focusAreas: [
      'Track the threat source, actor, environment, and likelihood so new or changing threats become visible early.',
      'Document the exposed asset or system, related vulnerability, and triage analysis so teams understand how the threat could be realized.',
      'Use mitigation ownership, vulnerability-response state, review cadence, intelligence updates, and linked risk context to keep the threat response current as conditions change.',
    ],
    relationshipHint:
      'Use links to connect threats to risks, incidents, assets, controls, assessments, evidence, and mitigation tasks.',
    emptyState:
      'Create the first threat to capture the warning, exposed context, vulnerability analysis, and mitigation posture tied to a changing threat condition.',
    relationshipPresets: [
      { relationType: 'risk', label: 'Linked Risk', route: '/risks' },
      { relationType: 'incident', label: 'Realized Incident', route: '/incidents' },
      { relationType: 'asset', label: 'Affected Asset', route: '/assets' },
      { relationType: 'security-control', label: 'Affected Security Control', route: '/security-controls' },
      { relationType: 'assessment', label: 'Threat Assessment', route: '/assessments' },
      { relationType: 'task', label: 'Mitigation Task', route: '/tasks' },
      { relationType: 'evidence', label: 'Threat Evidence', route: '/evidence-locker' },
    ],
  },
};

type RecordHighlight = {
  title: string;
  body: string;
  eyebrow?: string;
};

type WorkspaceMetric = {
  label: string;
  value: string | number;
};

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function isoDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.includes('T') ? value.slice(0, 10) : value;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function buildRenderableSections(
  entry: ModuleCatalogEntry | null,
  schema: FormBuilderDetail | null,
  runtime: FormRuntimeResult | null = null,
): RenderableSection[] {
  if (schema) {
    return schema.sections
      .filter((section) => {
        const runtimeSection = runtime?.sections[section.id] ?? runtime?.sections[section.displayName];
        return runtimeSection ? runtimeSection.visible : section.active;
      })
      .map((section) => ({
        id: section.id,
        displayName: section.displayName,
        fields: section.fields
          .filter((field) => {
            const runtimeField = runtime?.fields[field.systemName];
            return runtimeField ? runtimeField.visible : field.active;
          })
          .filter(
            (field) =>
              field.fieldType !== 'Label' &&
              field.fieldType !== 'HTML' &&
              field.fieldType !== 'Section Header' &&
              field.fieldType !== 'Button',
          )
          .map((field) => ({
            id: field.id,
            displayName: field.displayName,
            systemName: field.systemName,
            fieldType: field.fieldType,
            required: runtime?.fields[field.systemName]?.required ?? field.required,
            editable: runtime?.fields[field.systemName]?.editable ?? field.editable,
            helpText: field.helpText ?? null,
            choices: field.choices.filter((choice) => choice.active).map((choice) => choice.value || choice.label),
            errors: runtime?.fields[field.systemName]?.errors ?? [],
          })),
      }))
      .filter((section) => section.fields.length > 0);
  }

  const starterFields = entry?.starterFields ?? [];
  if (starterFields.length === 0) {
    return [];
  }

  return [
    {
      id: `${entry?.moduleKey ?? 'module'}-default`,
      displayName: 'Record Details',
      fields: starterFields.map((field) => ({
        id: `${entry?.moduleKey ?? 'module'}-${field.systemName}`,
        displayName: field.displayName,
        systemName: field.systemName,
        fieldType: field.fieldType,
        required: Boolean(field.required),
        editable: true,
        helpText: field.helpText ?? null,
        choices: field.choices ?? [],
        errors: [],
      })),
    },
  ];
}

function isTextAreaField(field: RenderableField) {
  return field.fieldType === 'Text Area' || field.fieldType === 'Rich Text';
}

function isSelectField(field: RenderableField) {
  return field.fieldType === 'Select' || field.choices.length > 0;
}

function isDateField(field: RenderableField) {
  return field.fieldType === 'Date' || field.fieldType === 'Date Time Hour' || field.fieldType === 'Date Label';
}

function isNumericField(field: RenderableField) {
  return (
    field.fieldType === 'Whole Number' ||
    field.fieldType === 'Number' ||
    field.fieldType === 'Dollar' ||
    field.fieldType === 'Currency Label' ||
    field.fieldType === 'Range' ||
    field.fieldType === 'Risk Probability' ||
    field.fieldType === 'Risk Consequence'
  );
}

function isBooleanField(field: RenderableField) {
  return field.fieldType === 'Checkbox' || field.fieldType === 'Toggle';
}

function deriveTitleFromData(data: Record<string, unknown>, fallback = '') {
  const candidates = ['title', 'name', 'vendor_name', 'policy_name', 'plan_name'];
  for (const key of candidates) {
    const value = normalizeText(data[key]).trim();
    if (value) {
      return value;
    }
  }
  return fallback;
}

function deriveStatusFromData(data: Record<string, unknown>, fallback = '') {
  const candidates = ['status', 'lifecycle_status', 'inventory_status', 'approval_status', 'implementation_status'];
  for (const key of candidates) {
    const value = normalizeText(data[key]).trim();
    if (value) {
      return value;
    }
  }
  return fallback;
}

function deriveDateSlots(data: Record<string, unknown>) {
  const findValue = (candidates: string[]) => {
    for (const candidate of candidates) {
      const value = normalizeText(data[candidate]).trim();
      if (value) {
        return value;
      }
    }
    return null;
  };

  return {
    startOn: findValue([
      'started_on',
      'actual_start',
      'identified_on',
      'purchase_date',
      'planned_start',
      'start_date',
      'requested_at',
      'date_requested',
      'reported_at',
      'detected_at',
      'realized_on',
      'effective_date',
    ]),
    finishOn: findValue(['completed_on', 'actual_finish', 'planned_finish', 'end_date', 'date_completed', 'recovery_date', 'disposition_date', 'closed_date', 'delivery_date']),
    dueOn: findValue([
      'due_date',
      'need_date',
      'next_due_date',
      'next_assessment_due',
      'target_date',
      'response_due_date',
      'mitigation_due_date',
      'attestation_due_date',
      'next_trend_snapshot_due',
      'next_intelligence_review_due',
    ]),
    reviewOn: findValue([
      'post_implementation_review_date',
      'verification_date',
      'review_date',
      'last_review_date',
      'last_control_assessed_on',
      'last_tested_date',
      'approval_date',
      'investigation_review_date',
      'ato_date',
      'accepted_on',
      'last_assessed_on',
      'last_vendor_assessed_on',
      'trend_snapshot_date',
    ]),
    expiresOn: findValue(['end_of_life_date', 'expiration_date', 'renewal_date', 'authorization_expiration', 'ato_expiration']),
  };
}

function createBlankDraft(entry: ModuleCatalogEntry | null, sections: RenderableSection[], defaultFolderId: string): ModuleDraft {
  const data: Record<string, unknown> = {};

  for (const section of sections) {
    for (const field of section.fields) {
      if (field.systemName in data) {
        continue;
      }
      if (isBooleanField(field)) {
        data[field.systemName] = false;
        continue;
      }
      data[field.systemName] = '';
    }
  }

  return {
    folderId: defaultFolderId,
    status: deriveStatusFromData(data, 'planned'),
    data,
    links: [],
    note: entry ? `Created from the ${entry.pluralName.toLowerCase()} tenant workspace.` : '',
  };
}

function buildDraftFromRecord(
  entry: ModuleCatalogEntry | null,
  record: ModuleRecord,
  sections: RenderableSection[],
): ModuleDraft {
  const data = { ...record.data };
  if (!('title' in data) && sections.some((section) => section.fields.some((field) => field.systemName === 'title'))) {
    data.title = record.title;
  }
  if (!('status' in data) && sections.some((section) => section.fields.some((field) => field.systemName === 'status'))) {
    data.status = record.status;
  }

  return {
    folderId: record.folderId,
    status: record.status || deriveStatusFromData(data, 'planned'),
    data,
    links: record.links,
    note: entry ? `Updated from the ${entry.moduleName.toLowerCase()} workspace.` : '',
  };
}

function buildPayloadFromDraft(draft: ModuleDraft): SaveModuleRecordInput {
  const normalizedData = Object.fromEntries(
    Object.entries(draft.data).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  );
  const title = deriveTitleFromData(normalizedData);
  const status = draft.status.trim() || deriveStatusFromData(normalizedData, 'planned');
  const slots = deriveDateSlots(normalizedData);
  return {
    folderId: draft.folderId,
    title: title || undefined,
    status: status || undefined,
    startOn: slots.startOn,
    finishOn: slots.finishOn,
    dueOn: slots.dueOn,
    reviewOn: slots.reviewOn,
    expiresOn: slots.expiresOn,
    data: normalizedData,
    links: draft.links.filter((link) => link.label.trim() || link.route || link.targetId),
    note: draft.note.trim() || null,
  };
}

function recordDateChips(record: ModuleRecord) {
  return [
    ['Start', record.startOn],
    ['Finish', record.finishOn],
    ['Due', record.dueOn],
    ['Review', record.reviewOn],
    ['Expires', record.expiresOn],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;
}

function moduleRecordHighlights(
  moduleKey: string,
  data: Record<string, unknown>,
): RecordHighlight[] {
  if (moduleKey === 'capabilities') {
    return [
      {
        eyebrow: 'Strategy',
        title: normalizeText(data.business_outcome).trim() || 'Business outcome not captured yet',
        body:
          normalizeText(data.strategic_alignment).trim() ||
          'Add strategic alignment so this capability can be traced to a business priority or mission outcome.',
      },
      {
        eyebrow: 'Operating Context',
        title:
          [
            normalizeText(data.business_unit).trim(),
            normalizeText(data.parent_program).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Business unit, program, and owner still need to be defined',
        body:
          normalizeText(data.objective).trim() ||
          'Capture the objective or target state this capability is expected to deliver.',
      },
      {
        eyebrow: 'Enablement & Risk',
        title:
          normalizeText(data.supporting_technologies).trim() ||
          normalizeText(data.supporting_platforms).trim() ||
          'Supporting technologies and platforms have not been mapped yet',
        body:
          normalizeText(data.risk_rollup).trim() ||
          'Summarize the main risks, assessment outputs, or dependencies that roll up into this capability.',
      },
      {
        eyebrow: 'Continuous Improvement',
        title:
          normalizeText(data.operational_efficiency).trim() ||
          normalizeText(data.resource_utilization).trim() ||
          'Operational efficiency and resource utilization notes are still empty',
        body:
          normalizeText(data.continuous_improvement).trim() ||
          'Use this section to capture improvement priorities, maturity actions, and the next iteration plan.',
      },
    ];
  }

  if (moduleKey === 'case-management') {
    return [
      {
        eyebrow: 'Case Intake',
        title:
          [
            normalizeText(data.case_type).trim(),
            normalizeText(data.severity).trim(),
            normalizeText(data.reported_at).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Case type, severity, and report timing still need to be defined',
        body:
          normalizeText(data.reported_by).trim() ||
          'Capture who reported the case and when it entered the response workflow.',
      },
      {
        eyebrow: 'Response & Ownership',
        title:
          [
            normalizeText(data.phase).trim(),
            normalizeText(data.status).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Response phase, status, and owner are still incomplete',
        body:
          normalizeText(data.mitigation_actions).trim() ||
          'Use mitigation actions to track the immediate response, response tasks, and planned corrective work.',
      },
      {
        eyebrow: 'Risk & Evidence',
        title:
          normalizeText(data.risk_summary).trim() ||
          normalizeText(data.legal_exposure).trim() ||
          'Risk summary and legal or policy exposure have not been recorded yet',
        body:
          normalizeText(data.evidence_summary).trim() ||
          normalizeText(data.forensic_timeline_summary).trim() ||
          'Summarize the evidence posture and forensic timeline so the case can support investigation and turnover needs.',
      },
      {
        eyebrow: 'Disposition',
        title:
          normalizeText(data.disposition).trim() ||
          'Final disposition has not been documented yet',
        body:
          normalizeText(data.root_cause).trim() ||
          'Document the root cause and final disposition so corrective actions can reduce recurrence.',
      },
    ];
  }

  if (moduleKey === 'components') {
    return [
      {
        eyebrow: 'Component Definition',
        title:
          [
            normalizeText(data.component_id).trim(),
            normalizeText(data.component_type).trim(),
            normalizeText(data.vendor).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Component ID, type, and vendor context are still incomplete',
        body:
          [
            normalizeText(data.capability).trim(),
            normalizeText(data.security_plan).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          normalizeText(data.description).trim() ||
          'Describe what this component is, who provides it, and what boundary or capability it supports.',
      },
      {
        eyebrow: 'Control Support',
        title:
          [
            normalizeText(data.supported_controls_count).trim(),
            normalizeText(data.assessment_status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Supported controls and assessment posture have not been documented yet',
        body:
          normalizeText(data.control_coverage_summary).trim() ||
          normalizeText(data.implementation_statement).trim() ||
          'Summarize how this component supports controls and what reusable implementation details SSP authors can leverage.',
      },
      {
        eyebrow: 'Authorization & Validation',
        title:
          [
            normalizeText(data.authorization_status).trim(),
            normalizeText(data.authorization_expiration).trim(),
            normalizeText(data.last_tested_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Authorization status, expiration, and last tested date are still incomplete',
        body:
          normalizeText(data.common_control_provider).trim() ||
          normalizeText(data.evidence_summary).trim() ||
          'Capture common-control provider context and the evidence that supports this component’s authorization posture.',
      },
    ];
  }

  if (moduleKey === 'security-plans') {
    return [
      {
        eyebrow: 'Boundary & System',
        title:
          [
            normalizeText(data.plan_name).trim(),
            normalizeText(data.system_name).trim(),
            normalizeText(data.other_identifier).trim(),
            normalizeText(data.system_type).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Plan name, system name, identifier, and system type are still incomplete',
        body:
          normalizeText(data.boundary_summary).trim() ||
          normalizeText(data.description).trim() ||
          'Describe the system boundary, major assets or components, and the mission or business context this plan covers.',
      },
      {
        eyebrow: 'Ownership & Authorization',
        title:
          [
            normalizeText(data.system_owner).trim(),
            normalizeText(data.authorizing_official).trim(),
            normalizeText(data.authorization_status).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'System owner, authorizing official, authorization status, and lifecycle status are still incomplete',
        body:
          [
            normalizeText(data.ato_date).trim(),
            normalizeText(data.ato_expiration).trim(),
            normalizeText(data.review_date).trim(),
            normalizeText(data.fips_category).trim(),
            normalizeText(data.overall_impact_level).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Capture authorization timing, review cadence, and categorization so the SSP lifecycle remains visible.',
      },
      {
        eyebrow: 'Categorization & Control Posture',
        title:
          [
            normalizeText(data.risk_maturity_level).trim(),
            normalizeText(data.confidentiality_impact).trim() && `C: ${normalizeText(data.confidentiality_impact).trim()}`,
            normalizeText(data.integrity_impact).trim() && `I: ${normalizeText(data.integrity_impact).trim()}`,
            normalizeText(data.availability_impact).trim() && `A: ${normalizeText(data.availability_impact).trim()}`,
            normalizeText(data.assessment_cadence).trim(),
            normalizeText(data.last_control_assessed_on).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Risk maturity, impact levels, assessment cadence, and control assessment timing are still incomplete',
        body:
          normalizeText(data.implementation_statement).trim() ||
          normalizeText(data.control_inheritance_summary).trim() ||
          normalizeText(data.risk_acceptance_summary).trim() ||
          'Summarize the implementation narrative, inherited-control posture, and residual-risk context that support the current authorization state.',
      },
      {
        eyebrow: 'Operating Context',
        title:
          [
            normalizeText(data.organization).trim(),
            normalizeText(data.facility).trim(),
            normalizeText(data.cloud_computing).trim(),
            normalizeText(data.broker_emass_id).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Organization, facility, cloud posture, and broker context are still incomplete',
        body:
          normalizeText(data.description).trim() ||
          'Use this area to capture operating-environment context, location, and cloud or broker details that affect the boundary.',
      },
    ];
  }

  if (moduleKey === 'projects') {
    return [
      {
        eyebrow: 'Project Setup',
        title:
          [
            normalizeText(data.project_reference).trim(),
            normalizeText(data.project_type).trim(),
            normalizeText(data.methodology).trim(),
            normalizeText(data.owner).trim(),
            normalizeText(data.deliverable_owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, type, methodology, owner, and deliverable accountability are still incomplete',
        body:
          [
            normalizeText(data.parent_program).trim(),
            normalizeText(data.executive_sponsor).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Identify the parent program, initiative, or portfolio context this project supports.',
      },
      {
        eyebrow: 'Scope & Drivers',
        title:
          [
            normalizeText(data.driver).trim(),
            normalizeText(data.objective).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Primary driver and objective are still incomplete',
        body:
          normalizeText(data.requirement_summary).trim() ||
          normalizeText(data.acceptance_criteria).trim() ||
          normalizeText(data.scope_change_summary).trim() ||
          'Summarize the committed scope, requirements, or deliverables this project is expected to deliver.',
      },
      {
        eyebrow: 'Cost & Schedule',
        title:
          [
            normalizeText(data.budget).trim(),
            normalizeText(data.spent_to_date).trim(),
            normalizeText(data.percent_complete).trim(),
            normalizeText(data.end_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Budget, spend, progress, and delivery date are still incomplete',
        body:
          normalizeText(data.schedule_variance).trim() ||
          normalizeText(data.budget_variance).trim() ||
          normalizeText(data.dependency_summary).trim() ||
          [normalizeText(data.schedule_health).trim(), normalizeText(data.budget_health).trim()].filter(Boolean).join(' · ') ||
          'Capture the current schedule and budget posture so delivery risk is visible early.',
      },
      {
        eyebrow: 'Quality, Risk & Value',
        title:
          [
            normalizeText(data.delivery_outcome).trim(),
            normalizeText(data.milestone_summary).trim(),
            normalizeText(data.quality_summary).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Delivery outcome, milestones, and quality posture have not been summarized yet',
        body:
          normalizeText(data.risk_summary).trim() ||
          normalizeText(data.benefits_realization).trim() ||
          normalizeText(data.quality_summary).trim() ||
          normalizeText(data.value_summary).trim() ||
          'Summarize the major project risks, quality posture, and expected value from delivery.',
      },
    ];
  }

  if (moduleKey === 'requests') {
    return [
      {
        eyebrow: 'Request Submission',
        title:
          [
            normalizeText(data.request_reference).trim(),
            normalizeText(data.request_type).trim(),
            normalizeText(data.request_channel).trim(),
            normalizeText(data.priority).trim(),
            normalizeText(data.requestor).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, request type, intake channel, priority, and requestor are still incomplete',
        body:
          normalizeText(data.description).trim() ||
          normalizeText(data.justification).trim() ||
          'Capture what service is being requested and why it needs to move through a formal fulfillment workflow.',
      },
      {
        eyebrow: 'Approval & Fulfillment',
        title:
          [
            normalizeText(data.fulfiller).trim(),
            normalizeText(data.approver).trim(),
            normalizeText(data.organization).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Fulfiller, approver, organization, and lifecycle status are still incomplete',
        body:
          [
            normalizeText(data.date_requested).trim(),
            normalizeText(data.approval_date).trim(),
            normalizeText(data.need_date).trim(),
            normalizeText(data.date_completed).trim(),
            normalizeText(data.service_level_target).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Track the ownership handoff and timing commitments from request submission through fulfillment.',
      },
      {
        eyebrow: 'Stakeholders, Milestones & Structure',
        title:
          normalizeText(data.key_stakeholders).trim() ||
          'Stakeholders and routing contacts have not been summarized yet',
        body:
          normalizeText(data.milestone_summary).trim() ||
          normalizeText(data.parent_request_reference).trim() ||
          normalizeText(data.child_request_summary).trim() ||
          'Use milestones to track complex requests, phased deliverables, and stakeholder-visible checkpoints.',
      },
      {
        eyebrow: 'Compliance & Execution',
        title:
          [
            normalizeText(data.issue_poam_summary).trim(),
            normalizeText(data.risk_summary).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Related issues, risks, questionnaires, and batch context are still incomplete',
        body:
          normalizeText(data.questionnaire_summary).trim() ||
          normalizeText(data.batch_operation_summary).trim() ||
          normalizeText(data.fulfillment_outcome).trim() ||
          normalizeText(data.notes).trim() ||
          'Link requests to compliance items and information-gathering workflows so service delivery stays audit-ready.',
      },
    ];
  }

  if (moduleKey === 'tasks') {
    return [
      {
        eyebrow: 'Assignment',
        title:
          [
            normalizeText(data.task_reference).trim(),
            normalizeText(data.task_type).trim(),
            normalizeText(data.priority).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Task reference, type, priority, and owner are still incomplete',
        body:
          [
            normalizeText(data.assigned_by).trim(),
            normalizeText(data.related_record).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Capture the source record or workstream this task supports so ownership stays tied to the underlying compliance work.',
      },
      {
        eyebrow: 'Schedule & Progress',
        title:
          [
            normalizeText(data.status).trim(),
            normalizeText(data.start_date).trim(),
            normalizeText(data.due_date).trim(),
            normalizeText(data.percent_complete).trim()
              ? `${normalizeText(data.percent_complete).trim()}% complete`
              : '',
          ]
            .filter(Boolean)
            .join(' · ') || 'Status, schedule, and progress are still incomplete',
        body:
          normalizeText(data.blocked_reason).trim() ||
          normalizeText(data.dependency_summary).trim() ||
          normalizeText(data.recurrence).trim() ||
          normalizeText(data.next_due_date).trim() ||
          'Use schedule, recurrence, and dependency notes to keep work moving and visible.',
      },
      {
        eyebrow: 'Completion Standard',
        title:
          normalizeText(data.success_criteria).trim() ||
          'Success criteria have not been documented yet',
        body:
          normalizeText(data.evidence_summary).trim() ||
          'Document the evidence or proof needed to show the task is complete and acceptable.',
      },
      {
        eyebrow: 'Closeout',
        title:
          [
            normalizeText(data.date_completed).trim(),
            normalizeText(data.reviewer).trim(),
            normalizeText(data.completion_outcome).trim(),
            normalizeText(data.verification_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Completion and verification timing are still incomplete',
        body:
          normalizeText(data.completion_notes).trim() ||
          normalizeText(data.notes).trim() ||
          'Capture what was done, what changed, and any remaining follow-up once the task closes.',
      },
    ];
  }

  if (moduleKey === 'threats') {
    return [
      {
        eyebrow: 'Threat Profile',
        title:
          [
            normalizeText(data.threat_reference).trim(),
            normalizeText(data.threat_type).trim(),
            normalizeText(data.source).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Threat reference, type, source, and lifecycle status are still incomplete',
        body:
          [
            normalizeText(data.threat_actor).trim(),
            normalizeText(data.environment_or_domain).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Capture who or what is driving the threat, where it applies, and who is coordinating the response.',
      },
      {
        eyebrow: 'Exposure & Triage',
        title:
          [
            normalizeText(data.likelihood).trim(),
            normalizeText(data.exploitability).trim(),
            normalizeText(data.triage_status).trim(),
            normalizeText(data.identified_on).trim(),
            normalizeText(data.review_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Likelihood, exploitability, triage posture, and review timing are still incomplete',
        body:
          normalizeText(data.related_vulnerability).trim() ||
          normalizeText(data.vulnerability_analysis).trim() ||
          normalizeText(data.exposure_summary).trim() ||
          'Document the exploitable weakness and the exposure path so analysts understand how the threat could be realized.',
      },
      {
        eyebrow: 'Affected Context & Risk',
        title:
          normalizeText(data.exposed_asset_or_system).trim() ||
          'Affected asset, system, or environment has not been identified yet',
        body:
          normalizeText(data.linked_risk_reference).trim() ||
          normalizeText(data.risk_assessment_summary).trim() ||
          normalizeText(data.exposure_summary).trim() ||
          'Summarize how the threat changes risk posture for the exposed asset, service, or business environment.',
      },
      {
        eyebrow: 'Mitigation & Monitoring',
        title:
          [
            normalizeText(data.mitigation_status).trim(),
            normalizeText(data.vulnerability_response_status).trim(),
            normalizeText(data.mitigation_owner).trim(),
            normalizeText(data.mitigation_due_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Mitigation status, response posture, owner, and due date are still incomplete',
        body:
          normalizeText(data.mitigation_summary).trim() ||
          normalizeText(data.monitoring_cadence).trim() ||
          normalizeText(data.next_intelligence_review_due).trim() ||
          normalizeText(data.threat_intelligence_summary).trim() ||
          normalizeText(data.evidence_summary).trim() ||
          normalizeText(data.notes).trim() ||
          'Capture the mitigation path, monitoring updates, and supporting evidence so the threat response stays current.',
      },
    ];
  }

  if (moduleKey === 'supply-chain') {
    return [
      {
        eyebrow: 'Vendor & Contract',
        title:
          [
            normalizeText(data.vendor_name).trim(),
            normalizeText(data.contract_id).trim(),
            normalizeText(data.contract_type).trim(),
            normalizeText(data.vendor_type).trim(),
            normalizeText(data.service_category).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Vendor, contract reference, contract type, and service category are still incomplete',
        body:
          [
            normalizeText(data.owner).trim(),
            normalizeText(data.contract_value).trim(),
            normalizeText(data.start_date).trim(),
            normalizeText(data.end_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Capture the vendor, internal owner, contract value, and lifecycle timing so the third-party relationship is clearly defined.',
      },
      {
        eyebrow: 'Risk & Assessment',
        title:
          [
            normalizeText(data.service_criticality).trim(),
            normalizeText(data.vendor_risk_rating).trim(),
            normalizeText(data.vendor_assessment_status).trim(),
            normalizeText(data.vendor_compliance_status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Service criticality, vendor risk rating, assessment posture, and compliance state are still incomplete',
        body:
          normalizeText(data.risk_assessment_summary).trim() ||
          [
            normalizeText(data.assessment_cadence).trim(),
            normalizeText(data.next_assessment_due).trim(),
            normalizeText(data.last_vendor_assessed_on).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          normalizeText(data.questionnaire_summary).trim() ||
          normalizeText(data.noncompliance_tracking).trim() ||
          'Summarize due diligence, questionnaire activity, and any open third-party compliance concerns.',
      },
      {
        eyebrow: 'Flowdown & Obligations',
        title:
          [
            normalizeText(data.third_party_flowdown).trim(),
            normalizeText(data.flowdown_scope).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Flowdown posture and requirement scope have not been documented yet',
        body:
          normalizeText(data.flowdown_summary).trim() ||
          'Describe the policies, requirements, and contract obligations that have been flowed down to this vendor or subcontractor.',
      },
      {
        eyebrow: 'Approval & Renewal',
        title:
          [
            normalizeText(data.approval_status).trim(),
            normalizeText(data.approver).trim(),
            normalizeText(data.renewal_date).trim(),
            normalizeText(data.review_date).trim(),
            normalizeText(data.renewal_decision).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Approval posture, renewal date, and review timing are still incomplete',
        body:
          normalizeText(data.renewal_strategy).trim() ||
          normalizeText(data.corrective_action_summary).trim() ||
          normalizeText(data.notes).trim() ||
          'Use this area to capture renewal strategy, closeout planning, or approval commentary for the vendor relationship.',
      },
    ];
  }

  if (moduleKey === 'data-calls') {
    return [
      {
        eyebrow: 'Request Intake',
        title:
          [
            normalizeText(data.request_reference).trim(),
            normalizeText(data.request_type).trim(),
            normalizeText(data.requested_to).trim(),
            normalizeText(data.requested_by).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, request type, recipient, and requester still need to be defined',
        body:
          normalizeText(data.pre_read_objective).trim() ||
          normalizeText(data.request_details).trim() ||
          normalizeText(data.assessment_or_matter).trim() ||
          'Capture what information is needed and the assessment or compliance matter this data call supports.',
      },
      {
        eyebrow: 'Delivery & Ownership',
        title:
          [
            normalizeText(data.owner).trim(),
            normalizeText(data.status).trim(),
            normalizeText(data.due_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Owner, status, and due date are still incomplete',
        body:
          [
            normalizeText(data.site_or_facility).trim(),
            normalizeText(data.delivery_method).trim(),
            normalizeText(data.requested_at).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Track who is coordinating the request, where it applies, and how the response will be delivered.',
      },
      {
        eyebrow: 'Evidence & Recurrence',
        title:
          [
            normalizeText(data.evidence_count).trim()
              ? `${normalizeText(data.evidence_count).trim()} evidence items`
              : '',
            normalizeText(data.completion_percent).trim()
              ? `${normalizeText(data.completion_percent).trim()}% complete`
              : '',
            normalizeText(data.recurrence).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Evidence count, completion percent, and recurrence are still incomplete',
        body:
          normalizeText(data.response_package_summary).trim() ||
          normalizeText(data.next_due_date).trim() ||
          'Use recurrence and next due date to avoid losing track of routine evidence submissions.',
      },
      {
        eyebrow: 'Audit Trail',
        title:
          [
            normalizeText(data.provided_to).trim(),
            normalizeText(data.delivery_date).trim(),
            normalizeText(data.delivery_method).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Delivery recipient, date, and method have not been documented yet',
        body:
          normalizeText(data.audit_trail_summary).trim() ||
          normalizeText(data.description).trim() ||
          'Document what was provided, to whom, and any additional delivery or escalation context needed for audit readiness.',
      },
    ];
  }

  if (moduleKey === 'evidence-locker') {
    return [
      {
        eyebrow: 'Repository Record',
        title:
          [
            normalizeText(data.evidence_type).trim(),
            normalizeText(data.evidence_owner).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Evidence type, owner, and status are still incomplete',
        body:
          normalizeText(data.evidence_summary).trim() ||
          'Summarize what this evidence contains and why it should be reused across audit activities.',
      },
      {
        eyebrow: 'Reuse & Mapping',
        title:
          [
            normalizeText(data.related_system).trim(),
            normalizeText(data.related_component).trim(),
            normalizeText(data.control_count).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Related systems, components, and mapped control coverage are still incomplete',
        body:
          normalizeText(data.mapped_control_summary).trim() ||
          normalizeText(data.shared_service_scope).trim() ||
          'Capture where this evidence can be reused and what control implementations it supports.',
      },
      {
        eyebrow: 'Update Cadence',
        title:
          [
            normalizeText(data.update_frequency).trim(),
            normalizeText(data.last_updated_on).trim(),
            normalizeText(data.next_due_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Update cadence and refresh dates are still incomplete',
        body:
          normalizeText(data.attestation_scope).trim() ||
          'Document the attestation or compliance scope that depends on this evidence remaining current.',
      },
      {
        eyebrow: 'Files & Audit Readiness',
        title:
          [
            normalizeText(data.file_count).trim()
              ? `${normalizeText(data.file_count).trim()} files`
              : '',
            normalizeText(data.related_record).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'File count and source record context have not been captured yet',
        body:
          normalizeText(data.description).trim() ||
          'Use this area for lifecycle notes, evidence handling context, and reviewer guidance.',
      },
    ];
  }

  if (moduleKey === 'exceptions') {
    return [
      {
        eyebrow: 'Exception Intake',
        title:
          [
            normalizeText(data.exception_reference).trim(),
            normalizeText(data.exception_type).trim(),
            normalizeText(data.control_or_requirement_reference).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, exception type, affected reference, and owner are still incomplete',
        body:
          normalizeText(data.requested_by).trim() ||
          normalizeText(data.exception_scope).trim() ||
          normalizeText(data.justification).trim() ||
          'Describe the affected control or requirement, the scope of relief, and why the exception is needed.',
      },
      {
        eyebrow: 'Feasibility & Risk',
        title:
          [
            normalizeText(data.risk_rating).trim(),
            normalizeText(data.requested_at).trim(),
            normalizeText(data.approval_status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Risk rating, request date, and approval status are still incomplete',
        body:
          normalizeText(data.business_impact).trim() ||
          normalizeText(data.risk_assessment_summary).trim() ||
          normalizeText(data.residual_risk_statement).trim() ||
          normalizeText(data.technical_feasibility).trim() ||
          normalizeText(data.cost_feasibility).trim() ||
          'Summarize the risk rationale and feasibility constraints behind the exception request.',
      },
      {
        eyebrow: 'Compensating Controls',
        title:
          normalizeText(data.compensating_controls).trim() ||
          'Compensating controls have not been documented yet',
        body:
          normalizeText(data.mitigation_plan).trim() ||
          'Document interim safeguards and the mitigation plan that reduce risk while the exception remains active.',
      },
      {
        eyebrow: 'Approval & Expiration',
        title:
          [
            normalizeText(data.approver).trim(),
            normalizeText(data.approval_date).trim(),
            normalizeText(data.expiration_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Approver, approval date, and expiration date are still incomplete',
        body:
          normalizeText(data.renewal_decision).trim() ||
          normalizeText(data.renewal_rationale).trim() ||
          normalizeText(data.review_date).trim() ||
          normalizeText(data.closure_notes).trim() ||
          'Track review, renewal, expiration, and closeout handling before the exception becomes a finding.',
      },
    ];
  }

  if (moduleKey === 'incidents') {
    return [
      {
        eyebrow: 'Detection & Triage',
        title:
          [
            normalizeText(data.incident_reference).trim(),
            normalizeText(data.incident_type).trim(),
            normalizeText(data.severity).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, incident type, and severity are still incomplete',
        body:
          normalizeText(data.detected_at).trim() ||
          normalizeText(data.reported_at).trim() ||
          'Capture when the incident was detected or reported so the response timeline is clear.',
      },
      {
        eyebrow: 'Response & Ownership',
        title:
          [
            normalizeText(data.response_phase).trim(),
            normalizeText(data.status).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Response phase, status, and owner are still incomplete',
        body:
          normalizeText(data.affected_asset_or_system).trim() ||
          normalizeText(data.response_summary).trim() ||
          'Track the affected system or asset and summarize how the team is responding.',
      },
      {
        eyebrow: 'Impact & Evidence',
        title:
          normalizeText(data.business_impact).trim() ||
          'Business impact has not been documented yet',
        body:
          normalizeText(data.mitigation_actions).trim() ||
          normalizeText(data.evidence_summary).trim() ||
          'Document containment actions, collected evidence, and the effect on operations.',
      },
      {
        eyebrow: 'Recovery & Root Cause',
        title:
          [
            normalizeText(data.recovery_date).trim(),
            normalizeText(data.root_cause).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Recovery and root-cause details are still incomplete',
        body:
          normalizeText(data.forensic_timeline_summary).trim() ||
          normalizeText(data.closure_notes).trim() ||
          'Capture the forensic timeline, recovery outcome, and closeout learnings to support future prevention.',
      },
    ];
  }

  if (moduleKey === 'interconnections') {
    return [
      {
        eyebrow: 'Boundary Pair',
        title:
          [
            normalizeText(data.interconnection_reference).trim(),
            normalizeText(data.connection_type).trim(),
            normalizeText(data.system_a).trim(),
            normalizeText(data.system_b).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, connection type, and system pair are still incomplete',
        body:
          normalizeText(data.purpose_of_exchange).trim() ||
          'Describe why these systems exchange data and what operational purpose the connection serves.',
      },
      {
        eyebrow: 'Approval & Ownership',
        title:
          [
            normalizeText(data.owner).trim(),
            normalizeText(data.data_owner).trim(),
            normalizeText(data.agreement_status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Owner, data owner, and agreement status are still incomplete',
        body:
          [
            normalizeText(data.approver).trim(),
            normalizeText(data.approval_date).trim(),
            normalizeText(data.expiration_date).trim(),
            normalizeText(data.review_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Track who approved the exchange and how long that approval remains in force.',
      },
      {
        eyebrow: 'Transport & Data Protection',
        title:
          [
            normalizeText(data.authentication_method).trim(),
            normalizeText(data.encryption_in_transit).trim(),
            normalizeText(data.data_classification).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Authentication, transport protection, and data sensitivity are still incomplete',
        body:
          normalizeText(data.data_shared).trim() ||
          normalizeText(data.least_privilege_notes).trim() ||
          'Summarize the data shared, how it is protected in transit, and how the exchange is limited to minimum necessary access.',
      },
      {
        eyebrow: 'Lifecycle & Dependency',
        title:
          [
            normalizeText(data.exchange_frequency).trim(),
            normalizeText(data.availability_expectation).trim(),
            normalizeText(data.review_date).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Exchange cadence, availability expectations, and lifecycle status are still incomplete',
        body:
          normalizeText(data.downtime_impact).trim() ||
          normalizeText(data.renewal_rationale).trim() ||
          normalizeText(data.closure_notes).trim() ||
          'Document cascading downtime impact, renewal needs, and eventual closeout handling for the interconnection.',
      },
    ];
  }

  if (moduleKey === 'risks') {
    const lensSummary = [
      normalizeText(data.business_risk_lens).trim() && `Business: ${normalizeText(data.business_risk_lens).trim()}`,
      normalizeText(data.operational_risk_lens).trim() && `Operational: ${normalizeText(data.operational_risk_lens).trim()}`,
      normalizeText(data.security_risk_lens).trim() && `Security: ${normalizeText(data.security_risk_lens).trim()}`,
      normalizeText(data.compliance_regulatory_risk_lens).trim() &&
        `Compliance: ${normalizeText(data.compliance_regulatory_risk_lens).trim()}`,
    ]
      .filter(Boolean)
      .join(' · ');

    return [
      {
        eyebrow: 'Risk Profile',
        title:
          [
            normalizeText(data.risk_id).trim(),
            normalizeText(data.risk_category).trim(),
            normalizeText(data.risk_level).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Risk ID, category, level, and lifecycle status are still incomplete',
        body:
          normalizeText(data.risk_statement).trim() ||
          normalizeText(data.threat_summary).trim() ||
          normalizeText(data.risk_source).trim() ||
          'Describe the risk clearly so reviewers understand the exposure and where it originates.',
      },
      {
        eyebrow: 'Exposure & Triggers',
        title:
          [
            normalizeText(data.likelihood).trim(),
            normalizeText(data.impact).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Likelihood, impact, and owner are still incomplete',
        body:
          normalizeText(data.trigger_events).trim() ||
          normalizeText(data.threat_summary).trim() ||
          normalizeText(data.assessment_reference).trim() ||
          'Document the conditions that could realize the risk and the assessment context behind the current rating.',
      },
      {
        eyebrow: 'Treatment & Residual',
        title:
          [
            normalizeText(data.treatment_strategy).trim(),
            normalizeText(data.mitigation_progress).trim(),
            normalizeText(data.risk_tolerance).trim(),
            normalizeText(data.mitigation_owner).trim(),
            normalizeText(data.approval_status).trim(),
            normalizeText(data.decision_maker).trim(),
            normalizeText(data.residual_risk_level).trim(),
            normalizeText(data.realized_on).trim(),
            normalizeText(data.review_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Treatment strategy, mitigation progress, tolerance posture, approval posture, decision maker, residual rating, realized-event timing, and review date are still incomplete',
        body:
          normalizeText(data.mitigation).trim() ||
          normalizeText(data.contingency_plan).trim() ||
          normalizeText(data.realized_event_summary).trim() ||
          normalizeText(data.acceptance_rationale).trim() ||
          normalizeText(data.review_summary).trim() ||
          normalizeText(data.evidence_summary).trim() ||
          'Summarize how the risk is being treated, what contingency exists if it is realized, what evidence supports the decision, and what residual posture remains.',
      },
      {
        eyebrow: 'Lenses & Trend',
        title:
          [
            normalizeText(data.previous_risk_level).trim(),
            normalizeText(data.trend_direction).trim(),
            normalizeText(data.trend_snapshot_date).trim(),
            normalizeText(data.next_trend_snapshot_due).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Trend direction, previous level, and snapshot timing are still incomplete',
        body:
          lensSummary ||
          normalizeText(data.project_cost_impact).trim() ||
          normalizeText(data.project_schedule_impact).trim() ||
          normalizeText(data.control_implementation_impact).trim() ||
          normalizeText(data.budget_decision_summary).trim() ||
          normalizeText(data.trend_summary).trim() ||
          'Use lens scoring and trend notes to show how the risk changes across business, operational, security, compliance, and other impact areas.',
      },
    ];
  }

  if (moduleKey === 'issues') {
    return [
      {
        eyebrow: 'Issue Intake',
        title:
          [
            normalizeText(data.issue_reference).trim(),
            normalizeText(data.issue_type).trim(),
            normalizeText(data.severity).trim(),
            normalizeText(data.discovered_on).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, type, severity, and discovery date are still incomplete',
        body:
          normalizeText(data.source_record).trim() ||
          normalizeText(data.requirement_or_policy_reference).trim() ||
          'Identify where the issue came from and which requirement, policy, or control it failed to satisfy.',
      },
      {
        eyebrow: 'Ownership & Remediation',
        title:
          [
            normalizeText(data.owner).trim(),
            normalizeText(data.corrective_action_owner).trim(),
            normalizeText(data.due_date).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Owner, due date, and remediation status are still incomplete',
        body:
          normalizeText(data.remediation_plan).trim() ||
          normalizeText(data.verification_plan).trim() ||
          'Document the corrective action plan, milestones, and how the issue will be verified before closure.',
      },
      {
        eyebrow: 'Impact & Evidence',
        title:
          normalizeText(data.impact_summary).trim() ||
          'Impact and issue context have not been summarized yet',
        body:
          normalizeText(data.evidence_summary).trim() ||
          'Capture the evidence and supporting proof that substantiate the issue and its severity.',
      },
      {
        eyebrow: 'Root Cause & Closure',
        title:
          [
            normalizeText(data.root_cause).trim(),
            normalizeText(data.closed_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Root cause and closure details are still incomplete',
        body:
          normalizeText(data.closure_summary).trim() ||
          'Use closure notes to show how the issue was resolved, validated, and prevented from recurring.',
      },
    ];
  }

  if (moduleKey === 'requirements') {
    return [
      {
        eyebrow: 'Requirement Definition',
        title:
          [
            normalizeText(data.requirement_id).trim(),
            normalizeText(data.requirement_type).trim(),
            normalizeText(data.requirement_priority).trim(),
            normalizeText(data.governing_source).trim(),
            normalizeText(data.applicable_law_or_regulation).trim(),
            normalizeText(data.status).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Requirement ID, type, priority, governing source, regulatory context, and lifecycle status are still incomplete',
        body:
          normalizeText(data.source_reference).trim() ||
          normalizeText(data.requirement_scope).trim() ||
          'Capture the source and scope so the requirement can be traced back to its governing obligation.',
      },
      {
        eyebrow: 'Ownership & Implementation',
        title:
          [
            normalizeText(data.owner).trim(),
            normalizeText(data.implementation_owner).trim(),
            normalizeText(data.implementation_status).trim(),
            normalizeText(data.related_policy_or_project).trim(),
            normalizeText(data.linked_record).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Owner, implementation owner, implementation status, related policy or project, and linked record are still incomplete',
        body:
          normalizeText(data.implementation_summary).trim() ||
          normalizeText(data.control_mapping_summary).trim() ||
          normalizeText(data.requirement_scope).trim() ||
          'Document how the requirement is implemented and which policy, project, or control record currently carries it.',
      },
      {
        eyebrow: 'Assessment & Review',
        title:
          [
            normalizeText(data.assessment_reference).trim(),
            normalizeText(data.assessment_method).trim(),
            normalizeText(data.assessment_owner).trim(),
            normalizeText(data.last_assessed_on).trim(),
            normalizeText(data.assessment_cadence).trim(),
            normalizeText(data.review_date).trim(),
            normalizeText(data.review_outcome).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Assessment reference, method, owner, dates, and review outcome are still incomplete',
        body:
          normalizeText(data.noncompliance_tracking).trim() ||
          'Track review timing, assessment ownership, and review outcomes so requirement implementations stay current and enforceable.',
      },
      {
        eyebrow: 'Evidence & Notes',
        title:
          [
            normalizeText(data.third_party_flowdown).trim(),
            normalizeText(data.third_party_acknowledgement).trim(),
            normalizeText(data.third_party_reference).trim(),
            normalizeText(data.flowdown_scope).trim(),
            normalizeText(data.superseded_by).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Flowdown, acknowledgement, replacement, and evidence details are still incomplete',
        body:
          normalizeText(data.flowdown_summary).trim() ||
          normalizeText(data.evidence_summary).trim() ||
          normalizeText(data.notes).trim() ||
          'Use flowdown, evidence, and notes to show how the requirement is enforced and maintained over time.',
      },
    ];
  }

  if (moduleKey === 'policies') {
    return [
      {
        eyebrow: 'Policy Definition',
        title:
          [
            normalizeText(data.policy_reference).trim(),
            normalizeText(data.policy_type).trim(),
            normalizeText(data.version).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Reference, type, version, and owner are still incomplete',
        body:
          normalizeText(data.policy_scope).trim() ||
          normalizeText(data.governing_source).trim() ||
          'Identify the governing source, scope, authority, or business driver that requires this policy.',
      },
      {
        eyebrow: 'Governance & Lifecycle',
        title:
          [
            normalizeText(data.status).trim(),
            normalizeText(data.approver).trim(),
            normalizeText(data.review_cadence).trim(),
            normalizeText(data.review_outcome).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Status, approver, review cadence, and review outcome are still incomplete',
        body:
          [
            normalizeText(data.approval_date).trim(),
            normalizeText(data.effective_date).trim(),
            normalizeText(data.last_review_date).trim(),
            normalizeText(data.expiration_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Approval, effective, review, and expiration dates still need to be documented',
      },
      {
        eyebrow: 'Implementation & Assurance',
        title:
          [
            normalizeText(data.implementation_status).trim(),
            normalizeText(data.assessment_cadence).trim(),
            normalizeText(data.attestation_required).trim(),
            normalizeText(data.attestation_due_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Implementation status, assessment cadence, and attestation details are still incomplete',
        body:
          normalizeText(data.requirement_implementation_summary).trim() ||
          normalizeText(data.noncompliance_tracking).trim() ||
          'Summarize how policy requirements are implemented, assessed, attested, and tracked for noncompliance.',
      },
      {
        eyebrow: 'Flow-down & Scope',
        title:
          [
            normalizeText(data.target_audience).trim(),
            normalizeText(data.distribution_method).trim(),
            normalizeText(data.third_party_flowdown).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Audience, distribution method, and third-party flow-down expectations are still incomplete',
        body:
          normalizeText(data.flowdown_scope).trim() ||
          normalizeText(data.superseded_by).trim() ||
          normalizeText(data.description).trim() ||
          'Document how this policy is distributed, how it applies to governed parties, and whether it has been superseded.',
      },
    ];
  }

  if (moduleKey === 'programs') {
    return [
      {
        eyebrow: 'Strategy & Outcomes',
        title:
          normalizeText(data.strategic_alignment).trim() ||
          normalizeText(data.objective).trim() ||
          'Strategic alignment and objective have not been captured yet',
        body:
          normalizeText(data.value_summary).trim() ||
          'Describe the business outcome or stakeholder value this program is intended to deliver.',
      },
      {
        eyebrow: 'Ownership & Portfolio',
        title:
          [
            normalizeText(data.program_type).trim(),
            normalizeText(data.business_unit).trim(),
            normalizeText(data.owner).trim(),
            normalizeText(data.executive_sponsor).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Program type, business unit, and owners are still incomplete',
        body:
          normalizeText(data.stakeholder_group).trim() ||
          'Identify the stakeholder group, mission owner, or customer community affected by the program.',
      },
      {
        eyebrow: 'Enablement & Coordination',
        title:
          normalizeText(data.supporting_capabilities).trim() ||
          normalizeText(data.supporting_technologies).trim() ||
          normalizeText(data.supporting_platforms).trim() ||
          'Supporting capabilities and technologies have not been mapped yet',
        body:
          normalizeText(data.resource_utilization).trim() ||
          'Summarize staffing, capacity, technology, or portfolio coordination dependencies.',
      },
      {
        eyebrow: 'Risk & Delivery',
        title:
          [
            normalizeText(data.status).trim(),
            normalizeText(data.target_date).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Status and target date are still incomplete',
        body:
          normalizeText(data.risk_rollup).trim() ||
          normalizeText(data.milestone_summary).trim() ||
          normalizeText(data.stakeholder_satisfaction).trim() ||
          'Capture delivery milestones, stakeholder sentiment, and the current portfolio risk view for the program.',
      },
    ];
  }

  if (moduleKey === 'changes') {
    return [
      {
        eyebrow: 'RFC Intake',
        title:
          [
            normalizeText(data.rfc_id).trim(),
            normalizeText(data.change_type).trim(),
            normalizeText(data.priority).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'RFC identifier, change type, and priority still need to be defined',
        body:
          [
            normalizeText(data.affected_service).trim(),
            normalizeText(data.affected_system).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          normalizeText(data.business_justification).trim() ||
          normalizeText(data.expected_benefits).trim() ||
          'Capture why the change is needed and the benefit it is expected to deliver.',
      },
      {
        eyebrow: 'Assessment & Approval',
        title:
          [
            normalizeText(data.risk_rating).trim(),
            normalizeText(data.approval_status).trim(),
            normalizeText(data.change_board).trim(),
            normalizeText(data.approver).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Risk, approval status, and approver are still incomplete',
        body:
          normalizeText(data.change_assessment).trim() ||
          'Summarize impact, dependency, cost, and service-disruption assessment before approval.',
      },
      {
        eyebrow: 'Implementation',
        title:
          [
            normalizeText(data.change_phase).trim(),
            normalizeText(data.implementation_status).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Implementation phase, status, and owner still need to be defined',
        body:
          normalizeText(data.outage_window).trim() ||
          normalizeText(data.implementation_plan).trim() ||
          normalizeText(data.testing_plan).trim() ||
          normalizeText(data.communication_plan).trim() ||
          normalizeText(data.rollback_plan).trim() ||
          'Document the execution plan, communications, testing, and rollback steps before implementation begins.',
      },
      {
        eyebrow: 'Review & Closure',
        title:
          [
            normalizeText(data.post_implementation_review_date).trim(),
            normalizeText(data.review_outcome).trim(),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Post-change review outcome has not been documented yet',
        body:
          normalizeText(data.evidence_summary).trim() ||
          normalizeText(data.description).trim() ||
          'Capture the review result, supporting evidence, and any follow-up action needed before closure.',
      },
    ];
  }

  if (moduleKey === 'causal-analysis') {
    return [
      {
        eyebrow: 'Analysis Setup',
        title:
          [
            normalizeText(data.analysis_method).trim(),
            normalizeText(data.analysis_phase).trim(),
            normalizeText(data.status).trim(),
            normalizeText(data.owner).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Method, status, and owner still need to be defined',
        body:
          normalizeText(data.source_record).trim() ||
          normalizeText(data.problem_statement).trim() ||
          'Link this analysis to the triggering issue, assessment, incident, or case and describe what failed.',
      },
      {
        eyebrow: 'Cause & Effect',
        title:
          [
            normalizeText(data.cause_type).trim(),
            normalizeText(data.cause_code).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Cause type and cause code are still incomplete',
        body:
          normalizeText(data.root_cause).trim() ||
          'Document the root cause so corrective actions address the underlying problem instead of only the symptom.',
      },
      {
        eyebrow: 'Timeline & Evidence',
        title:
          normalizeText(data.failure_timeline_summary).trim() ||
          'Failure timeline and contributing conditions have not been summarized yet',
        body:
          normalizeText(data.evidence_summary).trim() ||
          'Use this area to summarize event sequencing, evidence, and investigative observations that support the conclusion.',
      },
      {
        eyebrow: 'Corrective Action',
        title:
          [
            normalizeText(data.corrective_action_count).trim(),
            normalizeText(data.corrective_action_owner).trim(),
            normalizeText(data.recurrence_risk).trim(),
          ]
            .filter(Boolean)
            .join(' · ') || 'Corrective action count and recurrence risk are still incomplete',
        body:
          normalizeText(data.corrective_action_plan).trim() ||
          normalizeText(data.effectiveness_check).trim() ||
          normalizeText(data.trend_signal).trim() ||
          'Capture the corrective action plan and broader trend signal so the analysis drives continuous improvement.',
      },
    ];
  }

  return [];
}

function moduleWorkspaceMetrics(moduleKey: string, records: ModuleRecord[]): WorkspaceMetric[] | null {
  const activeRecords = records.filter((record) => !record.archived);

  if (moduleKey === 'case-management') {
    const today = new Date().toISOString().slice(0, 10);
    const urgentCases = activeRecords.filter((record) => {
      const severity = normalizeText(record.data.severity).trim().toLowerCase();
      return severity === 'high' || severity === 'critical';
    }).length;
    const overdueResponses = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.response_due_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due < today && status !== 'closed';
    }).length;
    const activeInvestigations = activeRecords.filter((record) => {
      const phase = normalizeText(record.data.phase).trim().toLowerCase();
      return ['triage', 'investigation', 'mitigation'].includes(phase);
    }).length;

    return [
      { label: 'Open cases', value: activeRecords.length },
      { label: 'High severity', value: urgentCases },
      { label: 'Overdue response', value: overdueResponses },
      { label: 'Active investigations', value: activeInvestigations },
    ];
  }

  if (moduleKey === 'components') {
    const today = new Date().toISOString().slice(0, 10);
    const expiringAuthorizations = activeRecords.filter((record) => {
      const expiry = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.authorization_expiration).trim() || null));
      return expiry !== null && expiry <= today;
    }).length;
    const validatedComponents = activeRecords.filter((record) => normalizeText(record.data.assessment_status).trim().toLowerCase() === 'validated').length;
    const supportedControls = activeRecords.reduce((sum, record) => {
      const count = Number(record.data.supported_controls_count ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
    const authorizedComponents = activeRecords.filter((record) => normalizeText(record.data.authorization_status).trim().toLowerCase() === 'authorized').length;

    return [
      { label: 'Active components', value: activeRecords.length },
      { label: 'Authorized', value: authorizedComponents },
      { label: 'Validated', value: validatedComponents },
      { label: 'Supported controls', value: supportedControls },
      { label: 'Authorization due', value: expiringAuthorizations },
    ];
  }

  if (moduleKey === 'security-plans') {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 90);
    const soonIso = soon.toISOString().slice(0, 10);
    const operational = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'operational').length;
    const underDevelopment = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'under development').length;
    const authorized = activeRecords.filter((record) => {
      const status = normalizeText(record.data.authorization_status).trim().toLowerCase();
      return status === 'authorized' || status === 'interim authorized';
    }).length;
    const cloudEnabled = activeRecords.filter((record) => normalizeText(record.data.cloud_computing).trim().toLowerCase() === 'yes').length;
    const authorizationDue = activeRecords.filter((record) => {
      const expiry = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.ato_expiration).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return expiry !== null && expiry <= soonIso && status !== 'decommissioned';
    }).length;
    const reviewDue = activeRecords.filter((record) => {
      const review = isoDateOnly(record.reviewOn ?? (normalizeText(record.data.review_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return review !== null && review <= todayIso && status !== 'decommissioned';
    }).length;
    const assessed = activeRecords.filter((record) => normalizeText(record.data.last_control_assessed_on).trim().length > 0).length;
    const implementationLogged = activeRecords.filter((record) => normalizeText(record.data.implementation_statement).trim().length > 0).length;
    const categorized = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.confidentiality_impact).trim().length > 0 &&
        normalizeText(record.data.integrity_impact).trim().length > 0 &&
        normalizeText(record.data.availability_impact).trim().length > 0 &&
        normalizeText(record.data.overall_impact_level).trim().length > 0
      );
    }).length;
    const inheritanceLogged = activeRecords.filter((record) => normalizeText(record.data.control_inheritance_summary).trim().length > 0).length;
    const cadenceLogged = activeRecords.filter((record) => normalizeText(record.data.assessment_cadence).trim().length > 0).length;
    const riskAcceptanceLogged = activeRecords.filter((record) => normalizeText(record.data.risk_acceptance_summary).trim().length > 0).length;

    return [
      { label: 'Open plans', value: activeRecords.length },
      { label: 'Operational', value: operational },
      { label: 'Under development', value: underDevelopment },
      { label: 'Authorized', value: authorized },
      { label: 'Cloud-enabled', value: cloudEnabled },
      { label: 'Categorized', value: categorized },
      { label: 'Authorization due', value: authorizationDue },
      { label: 'Review due', value: reviewDue },
      { label: 'Controls assessed', value: assessed },
      { label: 'Cadence logged', value: cadenceLogged },
      { label: 'Inheritance logged', value: inheritanceLogged },
      { label: 'Narrative logged', value: implementationLogged },
      { label: 'Risk acceptance logged', value: riskAcceptanceLogged },
    ];
  }

  if (moduleKey === 'data-calls') {
    const today = new Date().toISOString().slice(0, 10);
    const openCalls = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      return status !== 'closed' && status !== 'delivered';
    }).length;
    const overdueCalls = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.due_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due < today && status !== 'closed' && status !== 'delivered';
    }).length;
    const recurringCalls = activeRecords.filter((record) => {
      const recurrence = normalizeText(record.data.recurrence).trim().toLowerCase();
      return recurrence.length > 0 && recurrence !== 'one-time';
    }).length;
    const deliveredCalls = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'delivered').length;
    const onTimeDelivered = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.due_date).trim() || null));
      const delivered = isoDateOnly(record.finishOn ?? (normalizeText(record.data.delivery_date).trim() || null));
      return status === 'delivered' && due !== null && delivered !== null && delivered <= due;
    }).length;
    const evidenceCollected = activeRecords.reduce((sum, record) => {
      const count = Number(record.data.evidence_count ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
    const completionValues = activeRecords
      .map((record) => Number(record.data.completion_percent ?? NaN))
      .filter((value) => Number.isFinite(value));
    const averageCompletion =
      completionValues.length > 0
        ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length)
        : 0;

    return [
      { label: 'Open data calls', value: openCalls },
      { label: 'Overdue', value: overdueCalls },
      { label: 'Recurring', value: recurringCalls },
      { label: 'Delivered', value: deliveredCalls },
      { label: 'On-time delivered', value: onTimeDelivered },
      { label: 'Avg completion', value: `${averageCompletion}%` },
      { label: 'Evidence collected', value: evidenceCollected },
    ];
  }

  if (moduleKey === 'evidence-locker') {
    const today = new Date().toISOString().slice(0, 10);
    const activeEvidence = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'active').length;
    const dueForRefresh = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.next_due_date).trim() || null));
      return due !== null && due <= today;
    }).length;
    const sharedScopeEvidence = activeRecords.filter((record) => {
      return normalizeText(record.data.shared_service_scope).trim().length > 0;
    }).length;
    const mappedControls = activeRecords.reduce((sum, record) => {
      const count = Number(record.data.control_count ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
    const totalFiles = activeRecords.reduce((sum, record) => {
      const count = Number(record.data.file_count ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);

    return [
      { label: 'Active evidence', value: activeEvidence },
      { label: 'Refresh due', value: dueForRefresh },
      { label: 'Shared scope', value: sharedScopeEvidence },
      { label: 'Mapped controls', value: mappedControls },
      { label: 'Files stored', value: totalFiles },
    ];
  }

  if (moduleKey === 'exceptions') {
    const today = new Date().toISOString().slice(0, 10);
    const pendingApproval = activeRecords.filter((record) => normalizeText(record.data.approval_status).trim().toLowerCase() === 'pending').length;
    const approvedExceptions = activeRecords.filter((record) => normalizeText(record.data.approval_status).trim().toLowerCase() === 'approved').length;
    const expiredExceptions = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'expired').length;
    const expiringSoon = activeRecords.filter((record) => {
      const expiry = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.expiration_date).trim() || null));
      if (!expiry) {
        return false;
      }
      return expiry >= today && expiry <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }).length;
    const elevatedRisk = activeRecords.filter((record) => {
      const risk = normalizeText(record.data.risk_rating).trim().toLowerCase();
      return risk === 'high' || risk === 'critical';
    }).length;
    const reviewDue = activeRecords.filter((record) => {
      const review = isoDateOnly(record.reviewOn ?? (normalizeText(record.data.review_date).trim() || null));
      const status = normalizeText(record.data.approval_status).trim().toLowerCase();
      return review !== null && review <= today && status === 'approved';
    }).length;
    const renewalPending = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      const decision = normalizeText(record.data.renewal_decision).trim();
      return (status === 'expired' || status === 'closed') && decision.length === 0;
    }).length;

    return [
      { label: 'Open exceptions', value: activeRecords.length },
      { label: 'Pending approval', value: pendingApproval },
      { label: 'Approved', value: approvedExceptions },
      { label: 'Review due', value: reviewDue },
      { label: 'Expiring soon', value: expiringSoon },
      { label: 'Expired', value: expiredExceptions },
      { label: 'Renewal pending', value: renewalPending },
      { label: 'Elevated risk', value: elevatedRisk },
    ];
  }

  if (moduleKey === 'incidents') {
    const highSeverity = activeRecords.filter((record) => {
      const severity = normalizeText(record.data.severity).trim().toLowerCase();
      return severity === 'high' || severity === 'critical';
    }).length;
    const activeResponse = activeRecords.filter((record) => {
      const phase = normalizeText(record.data.response_phase).trim().toLowerCase();
      return ['triage', 'containment', 'investigation', 'recovery'].includes(phase);
    }).length;
    const recovered = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'recovered').length;
    const rootCauseLogged = activeRecords.filter((record) => normalizeText(record.data.root_cause).trim().length > 0).length;
    const underInvestigation = activeRecords.filter((record) => normalizeText(record.data.response_phase).trim().toLowerCase() === 'investigation').length;

    return [
      { label: 'Open incidents', value: activeRecords.length },
      { label: 'High severity', value: highSeverity },
      { label: 'Active response', value: activeResponse },
      { label: 'Under investigation', value: underInvestigation },
      { label: 'Recovered', value: recovered },
      { label: 'Root causes logged', value: rootCauseLogged },
    ];
  }

  if (moduleKey === 'interconnections') {
    const today = new Date().toISOString().slice(0, 10);
    const pendingApproval = activeRecords.filter((record) => normalizeText(record.data.agreement_status).trim().toLowerCase() === 'pending approval').length;
    const approved = activeRecords.filter((record) => normalizeText(record.data.agreement_status).trim().toLowerCase() === 'approved').length;
    const protectedExchanges = activeRecords.filter((record) => {
      const authentication = normalizeText(record.data.authentication_method).trim();
      const transport = normalizeText(record.data.encryption_in_transit).trim().toLowerCase();
      return authentication.length > 0 && transport.length > 0 && transport !== 'unknown';
    }).length;
    const expiringSoon = activeRecords.filter((record) => {
      const expiry = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.expiration_date).trim() || null));
      if (!expiry) {
        return false;
      }
      return expiry >= today && expiry <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }).length;
    const reviewDue = activeRecords.filter((record) => {
      const review = isoDateOnly(record.reviewOn ?? (normalizeText(record.data.review_date).trim() || null));
      return review !== null && review <= today;
    }).length;
    const renewalPending = activeRecords.filter((record) => {
      const lifecycle = normalizeText(record.data.status).trim().toLowerCase();
      const agreement = normalizeText(record.data.agreement_status).trim().toLowerCase();
      const decision = normalizeText(record.data.renewal_decision).trim();
      return (lifecycle === 'expired' || lifecycle === 'closed' || agreement === 'expired') && decision.length === 0;
    }).length;

    return [
      { label: 'Open interconnections', value: activeRecords.length },
      { label: 'Pending approval', value: pendingApproval },
      { label: 'Approved', value: approved },
      { label: 'Protected exchanges', value: protectedExchanges },
      { label: 'Expiring soon', value: expiringSoon },
      { label: 'Review due', value: reviewDue },
      { label: 'Renewal pending', value: renewalPending },
    ];
  }

  if (moduleKey === 'issues') {
    const today = new Date().toISOString().slice(0, 10);
    const openIssues = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() !== 'closed').length;
    const elevatedSeverity = activeRecords.filter((record) => {
      const severity = normalizeText(record.data.severity).trim().toLowerCase();
      return severity === 'high' || severity === 'critical';
    }).length;
    const overdueIssues = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.due_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due < today && status !== 'closed';
    }).length;
    const validationPending = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'pending validation').length;
    const rootCausesLogged = activeRecords.filter((record) => normalizeText(record.data.root_cause).trim().length > 0).length;
    const closureReady = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      const plan = normalizeText(record.data.remediation_plan).trim();
      const verification = normalizeText(record.data.verification_plan).trim();
      return status === 'pending validation' && plan.length > 0 && verification.length > 0;
    }).length;

    return [
      { label: 'Open issues', value: openIssues },
      { label: 'High severity', value: elevatedSeverity },
      { label: 'Overdue', value: overdueIssues },
      { label: 'Pending validation', value: validationPending },
      { label: 'Root causes logged', value: rootCausesLogged },
      { label: 'Closure ready', value: closureReady },
    ];
  }

  if (moduleKey === 'policies') {
    const today = new Date().toISOString().slice(0, 10);
    const approvedPolicies = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'approved').length;
    const pendingApproval = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'pending approval').length;
    const reviewDue = activeRecords.filter((record) => {
      const expiry = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.expiration_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return expiry !== null && expiry <= today && status !== 'expired' && status !== 'retired';
    }).length;
    const expiringSoon = activeRecords.filter((record) => {
      const expiry = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.expiration_date).trim() || null));
      if (!expiry) {
        return false;
      }
      return expiry >= today && expiry <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }).length;
    const thirdPartyFlowdown = activeRecords.filter((record) => {
      const flowdown = normalizeText(record.data.third_party_flowdown).trim().toLowerCase();
      return flowdown === 'required' || flowdown === 'recommended';
    }).length;
    const attestationDue = activeRecords.filter((record) => {
      const attestation = normalizeText(record.data.attestation_required).trim().toLowerCase();
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.attestation_due_date).trim() || null));
      return (attestation === 'required' || attestation === 'recommended') && due !== null && due <= today;
    }).length;
    const reviewOutcomePending = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      const outcome = normalizeText(record.data.review_outcome).trim();
      return (status === 'in review' || status === 'expired' || status === 'retired') && outcome.length === 0;
    }).length;
    const implementationGaps = activeRecords.filter((record) => {
      const implementation = normalizeText(record.data.implementation_status).trim().toLowerCase();
      return implementation === 'planned' || implementation === 'partially implemented' || implementation === 'needs review';
    }).length;

    return [
      { label: 'Open policies', value: activeRecords.length },
      { label: 'Approved', value: approvedPolicies },
      { label: 'Pending approval', value: pendingApproval },
      { label: 'Review due', value: reviewDue },
      { label: 'Expiring soon', value: expiringSoon },
      { label: 'Attestation due', value: attestationDue },
      { label: 'Flowed to third parties', value: thirdPartyFlowdown },
      { label: 'Review outcome pending', value: reviewOutcomePending },
      { label: 'Implementation gaps', value: implementationGaps },
    ];
  }

  if (moduleKey === 'programs') {
    const today = new Date().toISOString().slice(0, 10);
    const activePrograms = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'active').length;
    const atRiskPrograms = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'at risk').length;
    const onHoldPrograms = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'on hold').length;
    const targetDue = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.target_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due <= today && status !== 'completed';
    }).length;
    const capabilityMapped = activeRecords.filter((record) => normalizeText(record.data.supporting_capabilities).trim().length > 0).length;
    const riskRollupsLogged = activeRecords.filter((record) => normalizeText(record.data.risk_rollup).trim().length > 0).length;
    const stakeholderUpdates = activeRecords.filter((record) => normalizeText(record.data.stakeholder_satisfaction).trim().length > 0).length;

    return [
      { label: 'Open programs', value: activeRecords.length },
      { label: 'Active', value: activePrograms },
      { label: 'At risk', value: atRiskPrograms },
      { label: 'On hold', value: onHoldPrograms },
      { label: 'Target due', value: targetDue },
      { label: 'Capabilities mapped', value: capabilityMapped },
      { label: 'Risk rollups logged', value: riskRollupsLogged },
      { label: 'Stakeholder updates', value: stakeholderUpdates },
    ];
  }

  if (moduleKey === 'projects') {
    const today = new Date().toISOString().slice(0, 10);
    const activeProjects = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'active').length;
    const atRiskProjects = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'at risk').length;
    const onHoldProjects = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'on hold').length;
    const delayedProjects = activeRecords.filter((record) => normalizeText(record.data.schedule_health).trim().toLowerCase() === 'delayed').length;
    const overdueDelivery = activeRecords.filter((record) => {
      const target = isoDateOnly(record.finishOn ?? (normalizeText(record.data.end_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return target !== null && target < today && status !== 'completed';
    }).length;
    const completedProjects = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'completed').length;
    const overBudget = activeRecords.filter((record) => normalizeText(record.data.budget_health).trim().toLowerCase() === 'over budget').length;
    const dependencyMapped = activeRecords.filter((record) => normalizeText(record.data.dependency_summary).trim().length > 0).length;
    const outcomesLogged = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.delivery_outcome).trim().length > 0 ||
        normalizeText(record.data.benefits_realization).trim().length > 0
      );
    }).length;

    return [
      { label: 'Open projects', value: activeRecords.length },
      { label: 'Active', value: activeProjects },
      { label: 'At risk', value: atRiskProjects },
      { label: 'On hold', value: onHoldProjects },
      { label: 'Delayed', value: delayedProjects },
      { label: 'Overdue delivery', value: overdueDelivery },
      { label: 'Completed', value: completedProjects },
      { label: 'Over budget', value: overBudget },
      { label: 'Dependencies mapped', value: dependencyMapped },
      { label: 'Outcomes logged', value: outcomesLogged },
    ];
  }

  if (moduleKey === 'requests') {
    const today = new Date().toISOString().slice(0, 10);
    const submitted = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'submitted').length;
    const approved = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'approved').length;
    const inProgress = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'in progress').length;
    const onHold = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'on hold').length;
    const completed = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'completed').length;
    const urgent = activeRecords.filter((record) => normalizeText(record.data.priority).trim().toLowerCase() === 'urgent').length;
    const pendingApproval = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      return status === 'submitted' && normalizeText(record.data.approver).trim().length === 0;
    }).length;
    const overdueNeedDate = activeRecords.filter((record) => {
      const target = isoDateOnly(record.dueOn ?? (normalizeText(record.data.need_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return target !== null && target < today && status !== 'completed' && status !== 'cancelled';
    }).length;
    const questionnaireLinked = activeRecords.filter((record) => normalizeText(record.data.questionnaire_summary).trim().length > 0).length;
    const batchManaged = activeRecords.filter((record) => normalizeText(record.data.request_channel).trim().toLowerCase() === 'batch').length;
    const structuredChildren = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.parent_request_reference).trim().length > 0 ||
        normalizeText(record.data.child_request_summary).trim().length > 0
      );
    }).length;

    return [
      { label: 'Open requests', value: activeRecords.length },
      { label: 'Submitted', value: submitted },
      { label: 'Pending approval', value: pendingApproval },
      { label: 'Approved', value: approved },
      { label: 'In progress', value: inProgress },
      { label: 'On hold', value: onHold },
      { label: 'Urgent', value: urgent },
      { label: 'Batch managed', value: batchManaged },
      { label: 'Parent-child mapped', value: structuredChildren },
      { label: 'Overdue need date', value: overdueNeedDate },
      { label: 'Completed', value: completed },
      { label: 'Questionnaires linked', value: questionnaireLinked },
    ];
  }

  if (moduleKey === 'tasks') {
    const today = new Date().toISOString().slice(0, 10);
    const activeTasks = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'active').length;
    const blockedTasks = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'blocked').length;
    const inReview = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'in review').length;
    const completedTasks = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      return status === 'completed' || status === 'closed';
    }).length;
    const overdueTasks = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.due_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due < today && status !== 'completed' && status !== 'closed';
    }).length;
    const recurringTasks = activeRecords.filter((record) => {
      const recurrence = normalizeText(record.data.recurrence).trim().toLowerCase();
      return recurrence.length > 0 && recurrence !== 'one-time';
    }).length;
    const correctiveActions = activeRecords.filter((record) => normalizeText(record.data.task_type).trim().toLowerCase() === 'corrective action').length;
    const highPriority = activeRecords.filter((record) => {
      const priority = normalizeText(record.data.priority).trim().toLowerCase();
      return priority === 'high' || priority === 'critical';
    }).length;
    const onTimeCompleted = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.due_date).trim() || null));
      const completed = isoDateOnly(record.finishOn ?? (normalizeText(record.data.date_completed).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return (status === 'completed' || status === 'closed') && due !== null && completed !== null && completed <= due;
    }).length;
    const blockedReasonLogged = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      return status === 'blocked' && normalizeText(record.data.blocked_reason).trim().length > 0;
    }).length;
    const verificationPending = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      const verification = normalizeText(record.data.verification_date).trim();
      return (status === 'completed' || status === 'in review') && verification.length === 0;
    }).length;

    return [
      { label: 'Open tasks', value: activeRecords.length },
      { label: 'Active', value: activeTasks },
      { label: 'Blocked', value: blockedTasks },
      { label: 'In review', value: inReview },
      { label: 'Overdue', value: overdueTasks },
      { label: 'Recurring', value: recurringTasks },
      { label: 'Corrective actions', value: correctiveActions },
      { label: 'High priority', value: highPriority },
      { label: 'On-time completed', value: onTimeCompleted },
      { label: 'Blocked reason logged', value: blockedReasonLogged },
      { label: 'Verification pending', value: verificationPending },
      { label: 'Completed', value: completedTasks },
    ];
  }

  if (moduleKey === 'supply-chain') {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 60);
    const soonIso = soon.toISOString().slice(0, 10);
    const activeContracts = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'active').length;
    const underReview = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'under review').length;
    const renewalPending = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'renewal pending').length;
    const pendingApproval = activeRecords.filter((record) => {
      const approval = normalizeText(record.data.approval_status).trim().toLowerCase();
      return approval === 'pending approval' || approval === 'pending';
    }).length;
    const expiringSoon = activeRecords.filter((record) => {
      const renewal = isoDateOnly(record.expiresOn ?? (normalizeText(record.data.renewal_date).trim() || null));
      const end = isoDateOnly(record.finishOn ?? (normalizeText(record.data.end_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      const candidate = renewal ?? end;
      return candidate !== null && candidate >= todayIso && candidate <= soonIso && status !== 'closed' && status !== 'terminated';
    }).length;
    const highRisk = activeRecords.filter((record) => {
      const rating = normalizeText(record.data.vendor_risk_rating).trim().toLowerCase();
      return rating === 'high' || rating === 'critical';
    }).length;
    const assessmentDue = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.next_assessment_due).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due <= todayIso && status !== 'closed' && status !== 'terminated';
    }).length;
    const complianceGaps = activeRecords.filter((record) => {
      const compliance = normalizeText(record.data.vendor_compliance_status).trim().toLowerCase();
      return compliance === 'partially compliant' || compliance === 'non-compliant' || compliance === 'waiver / exception required';
    }).length;
    const flowdownComplete = activeRecords.filter((record) => normalizeText(record.data.third_party_flowdown).trim().toLowerCase() === 'complete').length;
    const questionnairesLinked = activeRecords.filter((record) => normalizeText(record.data.questionnaire_summary).trim().length > 0).length;

    return [
      { label: 'Open contracts', value: activeRecords.length },
      { label: 'Active', value: activeContracts },
      { label: 'Under review', value: underReview },
      { label: 'Pending approval', value: pendingApproval },
      { label: 'Renewal pending', value: renewalPending },
      { label: 'Expiring soon', value: expiringSoon },
      { label: 'Assessment due', value: assessmentDue },
      { label: 'High risk vendors', value: highRisk },
      { label: 'Compliance gaps', value: complianceGaps },
      { label: 'Flowdown complete', value: flowdownComplete },
      { label: 'Questionnaires linked', value: questionnairesLinked },
    ];
  }

  if (moduleKey === 'requirements') {
    const today = new Date().toISOString().slice(0, 10);
    const activeRequirements = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'active').length;
    const inReview = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'in review').length;
    const implemented = activeRecords.filter((record) => normalizeText(record.data.implementation_status).trim().toLowerCase() === 'implemented').length;
    const assessed = activeRecords.filter((record) => normalizeText(record.data.assessment_method).trim().length > 0).length;
    const controlMapped = activeRecords.filter((record) => normalizeText(record.data.control_mapping_summary).trim().length > 0).length;
    const reviewDue = activeRecords.filter((record) => {
      const review = isoDateOnly(record.reviewOn ?? (normalizeText(record.data.review_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return review !== null && review < today && status !== 'closed';
    }).length;
    const needsUpdate = activeRecords.filter((record) => {
      const outcome = normalizeText(record.data.review_outcome).trim().toLowerCase();
      return outcome === 'needs update' || outcome === 'non-compliant';
    }).length;
    const flowdownAcknowledged = activeRecords.filter((record) => {
      return normalizeText(record.data.third_party_acknowledgement).trim().toLowerCase() === 'received';
    }).length;
    const evidenceLogged = activeRecords.filter((record) => normalizeText(record.data.evidence_summary).trim().length > 0).length;

    return [
      { label: 'Open requirements', value: activeRecords.length },
      { label: 'Active', value: activeRequirements },
      { label: 'In review', value: inReview },
      { label: 'Implemented', value: implemented },
      { label: 'Assessment scoped', value: assessed },
      { label: 'Control mapped', value: controlMapped },
      { label: 'Review due', value: reviewDue },
      { label: 'Needs update', value: needsUpdate },
      { label: 'Flowdown acknowledged', value: flowdownAcknowledged },
      { label: 'Evidence logged', value: evidenceLogged },
    ];
  }

  if (moduleKey === 'changes') {
    const pendingApproval = activeRecords.filter((record) => normalizeText(record.data.approval_status).trim().toLowerCase() === 'pending').length;
    const activeImplementation = activeRecords.filter((record) => {
      const implementation = normalizeText(record.data.implementation_status).trim().toLowerCase();
      return implementation === 'in progress';
    }).length;
    const elevatedRisk = activeRecords.filter((record) => {
      const risk = normalizeText(record.data.risk_rating).trim().toLowerCase();
      return risk === 'high' || risk === 'critical';
    }).length;
    const rolledBack = activeRecords.filter((record) => normalizeText(record.data.implementation_status).trim().toLowerCase() === 'rolled back').length;
    const readyToImplement = activeRecords.filter((record) => normalizeText(record.data.implementation_status).trim().toLowerCase() === 'ready').length;
    const pirPending = activeRecords.filter((record) => {
      const implementation = normalizeText(record.data.implementation_status).trim().toLowerCase();
      const reviewOutcome = normalizeText(record.data.review_outcome).trim();
      return implementation === 'completed' && reviewOutcome.length === 0;
    }).length;

    return [
      { label: 'Open changes', value: activeRecords.length },
      { label: 'Pending approval', value: pendingApproval },
      { label: 'Ready to implement', value: readyToImplement },
      { label: 'In implementation', value: activeImplementation },
      { label: 'Elevated risk', value: elevatedRisk },
      { label: 'Rolled back', value: rolledBack },
      { label: 'PIR pending', value: pirPending },
    ];
  }

  if (moduleKey === 'causal-analysis') {
    const today = new Date().toISOString().slice(0, 10);
    const openAnalyses = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() !== 'closed').length;
    const overdueAnalyses = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.due_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due < today && status !== 'closed';
    }).length;
    const rootCauseLogged = activeRecords.filter((record) => normalizeText(record.data.root_cause).trim().length > 0).length;
    const correctiveActions = activeRecords.reduce((sum, record) => {
      const count = Number(record.data.corrective_action_count ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
    const elevatedRecurrence = activeRecords.filter((record) => {
      const risk = normalizeText(record.data.recurrence_risk).trim().toLowerCase();
      return risk === 'high' || risk === 'critical';
    }).length;

    return [
      { label: 'Open analyses', value: openAnalyses },
      { label: 'Overdue analyses', value: overdueAnalyses },
      { label: 'Root causes logged', value: rootCauseLogged },
      { label: 'Corrective actions', value: correctiveActions },
      { label: 'Elevated recurrence', value: elevatedRecurrence },
    ];
  }

  if (moduleKey === 'risks') {
    const today = new Date().toISOString().slice(0, 10);
    const highRisk = activeRecords.filter((record) => {
      const level = normalizeText(record.data.risk_level).trim().toLowerCase();
      return level === 'high' || level === 'critical';
    }).length;
    const accepted = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'accepted').length;
    const mitigating = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() === 'mitigating').length;
    const pendingReview = activeRecords.filter((record) => normalizeText(record.data.approval_status).trim().toLowerCase() === 'pending review').length;
    const approved = activeRecords.filter((record) => normalizeText(record.data.approval_status).trim().toLowerCase() === 'approved').length;
    const reviewDue = activeRecords.filter((record) => {
      const review = isoDateOnly(record.reviewOn ?? (normalizeText(record.data.review_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return review !== null && review <= today && status !== 'closed';
    }).length;
    const lensScored = activeRecords.filter((record) => {
      const lensValues = [
        'business_risk_lens',
        'operational_risk_lens',
        'safety_risk_lens',
        'security_risk_lens',
        'quality_risk_lens',
        'environmental_risk_lens',
        'reputation_risk_lens',
        'compliance_regulatory_risk_lens',
      ].map((key) => normalizeText(record.data[key]).trim().toLowerCase());
      return lensValues.some((value) => value.length > 0 && value !== 'no material impact');
    }).length;
    const trendingLogged = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.trend_direction).trim().length > 0 ||
        normalizeText(record.data.previous_risk_level).trim().length > 0 ||
        normalizeText(record.data.trend_summary).trim().length > 0
      );
    }).length;
    const residualRated = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.residual_risk_level).trim().length > 0 ||
        normalizeText(record.data.residual_likelihood).trim().length > 0 ||
        normalizeText(record.data.residual_impact).trim().length > 0
      );
    }).length;
    const threatContextLogged = activeRecords.filter((record) => {
      return normalizeText(record.data.threat_summary).trim().length > 0;
    }).length;
    const portfolioImpactLogged = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.project_cost_impact).trim().length > 0 ||
        normalizeText(record.data.project_schedule_impact).trim().length > 0 ||
        normalizeText(record.data.control_implementation_impact).trim().length > 0
      );
    }).length;
    const outOfTolerance = activeRecords.filter((record) => {
      return normalizeText(record.data.risk_tolerance).trim().toLowerCase() === 'out of tolerance';
    }).length;
    const contingencyLogged = activeRecords.filter((record) => normalizeText(record.data.contingency_plan).trim().length > 0).length;
    const realizedEventLogged = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.realized_event_summary).trim().length > 0 ||
        normalizeText(record.data.realized_on).trim().length > 0
      );
    }).length;
    const snapshotDue = activeRecords.filter((record) => {
      const nextSnapshot = isoDateOnly(record.dueOn ?? (normalizeText(record.data.next_trend_snapshot_due).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return nextSnapshot !== null && nextSnapshot <= today && status !== 'closed';
    }).length;
    const budgetDecisionLogged = activeRecords.filter((record) => normalizeText(record.data.budget_decision_summary).trim().length > 0).length;

    return [
      { label: 'Open risks', value: activeRecords.length },
      { label: 'High / critical', value: highRisk },
      { label: 'Pending review', value: pendingReview },
      { label: 'Approved', value: approved },
      { label: 'Accepted', value: accepted },
      { label: 'Mitigating', value: mitigating },
      { label: 'Out of tolerance', value: outOfTolerance },
      { label: 'Review due', value: reviewDue },
      { label: 'Threat context logged', value: threatContextLogged },
      { label: 'Contingency logged', value: contingencyLogged },
      { label: 'Realized events logged', value: realizedEventLogged },
      { label: 'Lens scored', value: lensScored },
      { label: 'Trend logged', value: trendingLogged },
      { label: 'Snapshot due', value: snapshotDue },
      { label: 'Residual rated', value: residualRated },
      { label: 'Portfolio impact logged', value: portfolioImpactLogged },
      { label: 'Budget decisions logged', value: budgetDecisionLogged },
    ];
  }

  if (moduleKey === 'threats') {
    const today = new Date().toISOString().slice(0, 10);
    const openThreats = activeRecords.filter((record) => normalizeText(record.status).trim().toLowerCase() !== 'closed').length;
    const highLikelihood = activeRecords.filter((record) => {
      const likelihood = normalizeText(record.data.likelihood).trim().toLowerCase();
      return likelihood === 'high' || likelihood === 'critical';
    }).length;
    const triagePending = activeRecords.filter((record) => {
      return normalizeText(record.data.triage_status).trim().toLowerCase() === 'triage pending';
    }).length;
    const underAnalysis = activeRecords.filter((record) => {
      return normalizeText(record.status).trim().toLowerCase() === 'under analysis';
    }).length;
    const mitigating = activeRecords.filter((record) => {
      const status = normalizeText(record.status).trim().toLowerCase();
      const mitigation = normalizeText(record.data.mitigation_status).trim().toLowerCase();
      return status === 'mitigating' || mitigation === 'in progress';
    }).length;
    const mitigationOverdue = activeRecords.filter((record) => {
      const due = isoDateOnly(record.dueOn ?? (normalizeText(record.data.mitigation_due_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return due !== null && due < today && status !== 'closed';
    }).length;
    const reviewDue = activeRecords.filter((record) => {
      const review = isoDateOnly(record.reviewOn ?? (normalizeText(record.data.review_date).trim() || null));
      const status = normalizeText(record.status).trim().toLowerCase();
      return review !== null && review <= today && status !== 'closed';
    }).length;
    const vulnerabilitiesMapped = activeRecords.filter((record) => normalizeText(record.data.related_vulnerability).trim().length > 0).length;
    const riskAssessmentsLogged = activeRecords.filter((record) => normalizeText(record.data.risk_assessment_summary).trim().length > 0).length;
    const linkedRisks = activeRecords.filter((record) => normalizeText(record.data.linked_risk_reference).trim().length > 0).length;
    const mitigationOwnerAssigned = activeRecords.filter((record) => normalizeText(record.data.mitigation_owner).trim().length > 0).length;
    const responseTracked = activeRecords.filter((record) => normalizeText(record.data.vulnerability_response_status).trim().length > 0).length;
    const monitoringLogged = activeRecords.filter((record) => {
      return (
        normalizeText(record.data.monitoring_cadence).trim().length > 0 ||
        normalizeText(record.data.next_intelligence_review_due).trim().length > 0
      );
    }).length;
    const intelligenceLogged = activeRecords.filter((record) => normalizeText(record.data.threat_intelligence_summary).trim().length > 0).length;

    return [
      { label: 'Open threats', value: openThreats },
      { label: 'High likelihood', value: highLikelihood },
      { label: 'Triage pending', value: triagePending },
      { label: 'Under analysis', value: underAnalysis },
      { label: 'Mitigating', value: mitigating },
      { label: 'Mitigation overdue', value: mitigationOverdue },
      { label: 'Review due', value: reviewDue },
      { label: 'Vulnerabilities mapped', value: vulnerabilitiesMapped },
      { label: 'Linked risks', value: linkedRisks },
      { label: 'Mitigation owner assigned', value: mitigationOwnerAssigned },
      { label: 'Response tracked', value: responseTracked },
      { label: 'Monitoring logged', value: monitoringLogged },
      { label: 'Risk assessments logged', value: riskAssessmentsLogged },
      { label: 'Intelligence logged', value: intelligenceLogged },
    ];
  }

  return null;
}

function moduleRecordBadges(moduleKey: string, record: ModuleRecord): string[] {
  if (moduleKey === 'case-management') {
    return [
      normalizeText(record.data.case_type).trim(),
      normalizeText(record.data.severity).trim(),
      normalizeText(record.data.phase).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'capabilities') {
    return [
      normalizeText(record.data.capability_type).trim(),
      normalizeText(record.data.business_unit).trim(),
      normalizeText(record.data.parent_program).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'components') {
    return [
      normalizeText(record.data.component_type).trim(),
      normalizeText(record.data.authorization_status).trim(),
      normalizeText(record.data.assessment_status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'security-plans') {
    return [
      normalizeText(record.data.system_type).trim(),
      normalizeText(record.data.overall_impact_level).trim(),
      normalizeText(record.data.authorization_status).trim(),
      normalizeText(record.data.risk_maturity_level).trim(),
      normalizeText(record.data.cloud_computing).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'data-calls') {
    return [
      normalizeText(record.data.request_reference).trim(),
      normalizeText(record.data.request_type).trim(),
      normalizeText(record.data.delivery_method).trim(),
      normalizeText(record.data.recurrence).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'evidence-locker') {
    return [
      normalizeText(record.data.evidence_type).trim(),
      normalizeText(record.data.update_frequency).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'exceptions') {
    return [
      normalizeText(record.data.exception_reference).trim(),
      normalizeText(record.data.exception_type).trim(),
      normalizeText(record.data.risk_rating).trim(),
      normalizeText(record.data.approval_status).trim(),
      normalizeText(record.data.renewal_decision).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'incidents') {
    return [
      normalizeText(record.data.incident_type).trim(),
      normalizeText(record.data.severity).trim(),
      normalizeText(record.data.response_phase).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'interconnections') {
    return [
      normalizeText(record.data.connection_type).trim(),
      normalizeText(record.data.agreement_status).trim(),
      normalizeText(record.data.encryption_in_transit).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'risks') {
    return [
      normalizeText(record.data.risk_category).trim(),
      normalizeText(record.data.risk_level).trim(),
      normalizeText(record.data.treatment_strategy).trim(),
      normalizeText(record.data.risk_tolerance).trim(),
      normalizeText(record.data.approval_status).trim(),
      normalizeText(record.data.mitigation_owner).trim(),
      normalizeText(record.data.trend_direction).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'threats') {
    return [
      normalizeText(record.data.threat_type).trim(),
      normalizeText(record.data.likelihood).trim(),
      normalizeText(record.data.exploitability).trim(),
      normalizeText(record.data.triage_status).trim(),
      normalizeText(record.data.mitigation_status).trim(),
      normalizeText(record.data.vulnerability_response_status).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'issues') {
    return [
      normalizeText(record.data.issue_type).trim(),
      normalizeText(record.data.severity).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'requirements') {
    return [
      normalizeText(record.data.requirement_type).trim(),
      normalizeText(record.data.requirement_priority).trim(),
      normalizeText(record.data.implementation_status).trim(),
      normalizeText(record.data.review_outcome).trim(),
      normalizeText(record.data.third_party_flowdown).trim(),
      normalizeText(record.data.third_party_acknowledgement).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'policies') {
    return [
      normalizeText(record.data.policy_type).trim(),
      normalizeText(record.data.implementation_status).trim(),
      normalizeText(record.data.third_party_flowdown).trim(),
      normalizeText(record.data.attestation_required).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'programs') {
    return [
      normalizeText(record.data.program_type).trim(),
      normalizeText(record.data.business_unit).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'projects') {
    return [
      normalizeText(record.data.project_type).trim(),
      normalizeText(record.data.methodology).trim(),
      normalizeText(record.data.schedule_health).trim(),
      normalizeText(record.data.budget_health).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'requests') {
    return [
      normalizeText(record.data.request_type).trim(),
      normalizeText(record.data.request_channel).trim(),
      normalizeText(record.data.priority).trim(),
      normalizeText(record.data.organization).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'tasks') {
    return [
      normalizeText(record.data.task_type).trim(),
      normalizeText(record.data.priority).trim(),
      normalizeText(record.data.recurrence).trim(),
      normalizeText(record.data.completion_outcome).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'supply-chain') {
    return [
      normalizeText(record.data.contract_type).trim(),
      normalizeText(record.data.vendor_type).trim(),
      normalizeText(record.data.service_criticality).trim(),
      normalizeText(record.data.vendor_risk_rating).trim(),
      normalizeText(record.data.vendor_assessment_status).trim(),
      normalizeText(record.data.vendor_compliance_status).trim(),
      normalizeText(record.data.assessment_cadence).trim(),
      normalizeText(record.data.third_party_flowdown).trim(),
      normalizeText(record.data.approval_status).trim(),
      normalizeText(record.status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'changes') {
    return [
      normalizeText(record.data.change_type).trim(),
      normalizeText(record.data.priority).trim(),
      normalizeText(record.data.change_phase).trim(),
      normalizeText(record.data.approval_status).trim(),
      normalizeText(record.data.implementation_status).trim(),
    ].filter(Boolean);
  }

  if (moduleKey === 'causal-analysis') {
    return [
      normalizeText(record.data.analysis_method).trim(),
      normalizeText(record.data.analysis_phase).trim(),
      normalizeText(record.data.cause_type).trim(),
      normalizeText(record.data.cause_code).trim(),
    ].filter(Boolean);
  }

  return [];
}

function moduleRecordSecondaryText(moduleKey: string, record: ModuleRecord): string | null {
  if (moduleKey === 'case-management') {
    return (
      normalizeText(record.data.risk_summary).trim() ||
      normalizeText(record.data.legal_exposure).trim() ||
      normalizeText(record.data.mitigation_actions).trim() ||
      null
    );
  }

  if (moduleKey === 'capabilities') {
    return (
      normalizeText(record.data.business_outcome).trim() ||
      normalizeText(record.data.objective).trim() ||
      normalizeText(record.data.risk_rollup).trim() ||
      null
    );
  }

  if (moduleKey === 'components') {
    return (
      normalizeText(record.data.control_coverage_summary).trim() ||
      normalizeText(record.data.description).trim() ||
      normalizeText(record.data.implementation_statement).trim() ||
      null
    );
  }

  if (moduleKey === 'security-plans') {
    return (
      normalizeText(record.data.boundary_summary).trim() ||
      normalizeText(record.data.description).trim() ||
      normalizeText(record.data.implementation_statement).trim() ||
      normalizeText(record.data.control_inheritance_summary).trim() ||
      normalizeText(record.data.risk_acceptance_summary).trim() ||
      null
    );
  }

  if (moduleKey === 'data-calls') {
    return (
      normalizeText(record.data.assessment_or_matter).trim() ||
      normalizeText(record.data.pre_read_objective).trim() ||
      normalizeText(record.data.response_package_summary).trim() ||
      normalizeText(record.data.request_details).trim() ||
      normalizeText(record.data.audit_trail_summary).trim() ||
      null
    );
  }

  if (moduleKey === 'evidence-locker') {
    return (
      normalizeText(record.data.mapped_control_summary).trim() ||
      normalizeText(record.data.shared_service_scope).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      normalizeText(record.data.attestation_scope).trim() ||
      null
    );
  }

  if (moduleKey === 'exceptions') {
    return (
      normalizeText(record.data.justification).trim() ||
      normalizeText(record.data.business_impact).trim() ||
      normalizeText(record.data.risk_assessment_summary).trim() ||
      normalizeText(record.data.residual_risk_statement).trim() ||
      normalizeText(record.data.compensating_controls).trim() ||
      normalizeText(record.data.mitigation_plan).trim() ||
      normalizeText(record.data.renewal_rationale).trim() ||
      null
    );
  }

  if (moduleKey === 'incidents') {
    return (
      normalizeText(record.data.business_impact).trim() ||
      normalizeText(record.data.mitigation_actions).trim() ||
      normalizeText(record.data.response_summary).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      null
    );
  }

  if (moduleKey === 'interconnections') {
    return (
      normalizeText(record.data.purpose_of_exchange).trim() ||
      normalizeText(record.data.data_shared).trim() ||
      normalizeText(record.data.availability_expectation).trim() ||
      normalizeText(record.data.least_privilege_notes).trim() ||
      normalizeText(record.data.renewal_rationale).trim() ||
      normalizeText(record.data.downtime_impact).trim() ||
      null
    );
  }

  if (moduleKey === 'risks') {
    return (
      normalizeText(record.data.risk_statement).trim() ||
      normalizeText(record.data.threat_summary).trim() ||
      normalizeText(record.data.risk_source).trim() ||
      normalizeText(record.data.trigger_events).trim() ||
      normalizeText(record.data.mitigation).trim() ||
      normalizeText(record.data.contingency_plan).trim() ||
      normalizeText(record.data.realized_event_summary).trim() ||
      normalizeText(record.data.acceptance_rationale).trim() ||
      normalizeText(record.data.review_summary).trim() ||
      normalizeText(record.data.project_cost_impact).trim() ||
      normalizeText(record.data.project_schedule_impact).trim() ||
      normalizeText(record.data.control_implementation_impact).trim() ||
      normalizeText(record.data.budget_decision_summary).trim() ||
      normalizeText(record.data.trend_summary).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      null
    );
  }

  if (moduleKey === 'threats') {
    return (
      normalizeText(record.data.related_vulnerability).trim() ||
      normalizeText(record.data.vulnerability_analysis).trim() ||
      normalizeText(record.data.exposure_summary).trim() ||
      normalizeText(record.data.linked_risk_reference).trim() ||
      normalizeText(record.data.risk_assessment_summary).trim() ||
      normalizeText(record.data.mitigation_summary).trim() ||
      normalizeText(record.data.mitigation_owner).trim() ||
      normalizeText(record.data.vulnerability_response_status).trim() ||
      normalizeText(record.data.monitoring_cadence).trim() ||
      normalizeText(record.data.next_intelligence_review_due).trim() ||
      normalizeText(record.data.threat_intelligence_summary).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      normalizeText(record.data.notes).trim() ||
      null
    );
  }

  if (moduleKey === 'issues') {
    return (
      normalizeText(record.data.impact_summary).trim() ||
      normalizeText(record.data.remediation_plan).trim() ||
      normalizeText(record.data.root_cause).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      normalizeText(record.data.closure_summary).trim() ||
      null
    );
  }

  if (moduleKey === 'requirements') {
    return (
      normalizeText(record.data.applicable_law_or_regulation).trim() ||
      normalizeText(record.data.requirement_scope).trim() ||
      normalizeText(record.data.implementation_summary).trim() ||
      normalizeText(record.data.control_mapping_summary).trim() ||
      normalizeText(record.data.related_policy_or_project).trim() ||
      normalizeText(record.data.assessment_reference).trim() ||
      normalizeText(record.data.flowdown_scope).trim() ||
      normalizeText(record.data.third_party_reference).trim() ||
      normalizeText(record.data.noncompliance_tracking).trim() ||
      normalizeText(record.data.flowdown_summary).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      normalizeText(record.data.superseded_by).trim() ||
      normalizeText(record.data.notes).trim() ||
      null
    );
  }

  if (moduleKey === 'policies') {
    return (
      normalizeText(record.data.governing_source).trim() ||
      normalizeText(record.data.policy_scope).trim() ||
      normalizeText(record.data.target_audience).trim() ||
      normalizeText(record.data.distribution_method).trim() ||
      normalizeText(record.data.requirement_implementation_summary).trim() ||
      normalizeText(record.data.flowdown_scope).trim() ||
      normalizeText(record.data.noncompliance_tracking).trim() ||
      normalizeText(record.data.superseded_by).trim() ||
      normalizeText(record.data.description).trim() ||
      null
    );
  }

  if (moduleKey === 'programs') {
    return (
      normalizeText(record.data.objective).trim() ||
      normalizeText(record.data.strategic_alignment).trim() ||
      normalizeText(record.data.value_summary).trim() ||
      normalizeText(record.data.risk_rollup).trim() ||
      normalizeText(record.data.stakeholder_satisfaction).trim() ||
      null
    );
  }

  if (moduleKey === 'projects') {
    return (
      [
        normalizeText(record.data.requirement_summary).trim(),
        normalizeText(record.data.acceptance_criteria).trim(),
        normalizeText(record.data.dependency_summary).trim(),
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ') ||
      normalizeText(record.data.scope_change_summary).trim() ||
      normalizeText(record.data.benefits_realization).trim() ||
      normalizeText(record.data.objective).trim() ||
      normalizeText(record.data.milestone_summary).trim() ||
      normalizeText(record.data.risk_summary).trim() ||
      normalizeText(record.data.value_summary).trim() ||
      null
    );
  }

  if (moduleKey === 'requests') {
    return (
      normalizeText(record.data.description).trim() ||
      normalizeText(record.data.justification).trim() ||
      normalizeText(record.data.service_level_target).trim() ||
      normalizeText(record.data.parent_request_reference).trim() ||
      normalizeText(record.data.child_request_summary).trim() ||
      normalizeText(record.data.issue_poam_summary).trim() ||
      normalizeText(record.data.risk_summary).trim() ||
      normalizeText(record.data.questionnaire_summary).trim() ||
      normalizeText(record.data.batch_operation_summary).trim() ||
      normalizeText(record.data.fulfillment_outcome).trim() ||
      normalizeText(record.data.notes).trim() ||
      null
    );
  }

  if (moduleKey === 'tasks') {
    return (
      normalizeText(record.data.blocked_reason).trim() ||
      normalizeText(record.data.related_record).trim() ||
      normalizeText(record.data.dependency_summary).trim() ||
      normalizeText(record.data.success_criteria).trim() ||
      normalizeText(record.data.evidence_summary).trim() ||
      normalizeText(record.data.completion_notes).trim() ||
      normalizeText(record.data.reviewer).trim() ||
      normalizeText(record.data.completion_outcome).trim() ||
      normalizeText(record.data.notes).trim() ||
      null
    );
  }

  if (moduleKey === 'supply-chain') {
    return (
      normalizeText(record.data.risk_assessment_summary).trim() ||
      normalizeText(record.data.flowdown_summary).trim() ||
      normalizeText(record.data.questionnaire_summary).trim() ||
      normalizeText(record.data.noncompliance_tracking).trim() ||
      normalizeText(record.data.corrective_action_summary).trim() ||
      normalizeText(record.data.renewal_strategy).trim() ||
      normalizeText(record.data.renewal_decision).trim() ||
      normalizeText(record.data.notes).trim() ||
      null
    );
  }

  if (moduleKey === 'changes') {
    return (
      [
        normalizeText(record.data.affected_service).trim(),
        normalizeText(record.data.affected_system).trim(),
      ]
        .filter(Boolean)
        .join(' · ') ||
      normalizeText(record.data.business_justification).trim() ||
      normalizeText(record.data.change_assessment).trim() ||
      normalizeText(record.data.outage_window).trim() ||
      normalizeText(record.data.review_outcome).trim() ||
      null
    );
  }

  if (moduleKey === 'causal-analysis') {
    return (
      normalizeText(record.data.root_cause).trim() ||
      normalizeText(record.data.problem_statement).trim() ||
      normalizeText(record.data.corrective_action_plan).trim() ||
      normalizeText(record.data.effectiveness_check).trim() ||
      null
    );
  }

  return null;
}

export function SharedModuleWorkspacePage({ fixedModuleKey }: SharedModuleWorkspacePageProps) {
  const params = useParams<{ moduleKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const moduleKey = fixedModuleKey ?? params.moduleKey ?? '';
  const requestedRecordId = searchParams.get('record');
  const [moduleEntry, setModuleEntry] = useState<ModuleCatalogEntry | null>(null);
  const [schema, setSchema] = useState<FormBuilderDetail | null>(null);
  const [records, setRecords] = useState<ModuleRecord[]>([]);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    folderId: '',
    includeArchived: false,
  });
  const [draft, setDraft] = useState<ModuleDraft | null>(null);

  const baseRenderableSections = useMemo(
    () => buildRenderableSections(moduleEntry, schema),
    [moduleEntry, schema],
  );
  const domainFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'domain'),
    [folders],
  );
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );
  const activeRuntimeData = draft?.data ?? selectedRecord?.data ?? {};
  const formRuntime = useMemo(
    () =>
      evaluateFormRuntime(schema, activeRuntimeData, {
        isNewRecord: isCreating || !selectedRecord,
        enabledModules: moduleEntry ? [moduleEntry.moduleKey, ...moduleEntry.relatedModules] : [],
      }),
    [activeRuntimeData, isCreating, moduleEntry, schema, selectedRecord],
  );
  const runtimeDataSignature = useMemo(() => JSON.stringify(formRuntime.data), [formRuntime.data]);
  const renderableSections = useMemo(
    () => buildRenderableSections(moduleEntry, schema, formRuntime),
    [formRuntime, moduleEntry, schema],
  );
  const moduleGuidance = moduleEntry ? MODULE_WORKSPACE_GUIDANCE[moduleEntry.moduleKey] ?? null : null;
  const activeRecordData = draft?.data ?? selectedRecord?.data ?? {};
  const highlights = moduleEntry ? moduleRecordHighlights(moduleEntry.moduleKey, activeRecordData) : [];
  const workspaceMetrics = moduleEntry ? moduleWorkspaceMetrics(moduleEntry.moduleKey, records) : null;

  async function loadMetadata() {
    if (!moduleKey) {
      setError('Module route is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [catalogEntry, folderResponse, formModules] = await Promise.all([
        getModuleCatalogEntry(moduleKey),
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        listFormBuilderModules(),
      ]);

      setModuleEntry(catalogEntry);
      setFolders(folderResponse.data);

      const matchingFormModule = formModules.find((item) => item.moduleKey === moduleKey);
      if (matchingFormModule) {
        const detail = await getFormBuilderModule(matchingFormModule.id);
        setSchema(detail);
      } else {
        setSchema(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the module workspace.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecords() {
    if (!moduleKey) {
      return;
    }
    try {
      setRecordsLoading(true);
      setError(null);
      const response = await listModuleRecords(moduleKey, filters);
      setModuleEntry(response.module);
      setRecords(response.records);
      setSelectedRecordId((current) => {
        if (isCreating) {
          return current;
        }
        if (requestedRecordId && response.records.some((record) => record.id === requestedRecordId)) {
          return requestedRecordId;
        }
        if (current && response.records.some((record) => record.id === current)) {
          return current;
        }
        return response.records[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load module records.');
    } finally {
      setRecordsLoading(false);
    }
  }

  useEffect(() => {
    void loadMetadata();
  }, [moduleKey]);

  useEffect(() => {
    void loadRecords();
  }, [moduleKey, filters.q, filters.status, filters.folderId, filters.includeArchived, requestedRecordId]);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsCreating(true);
      setSelectedRecordId(null);
      if (moduleEntry) {
        setDraft(createBlankDraft(moduleEntry, baseRenderableSections, domainFolders[0]?.id ?? ''));
      }
    }
  }, [baseRenderableSections, domainFolders, moduleEntry, searchParams]);

  useEffect(() => {
    if (isCreating) {
      setDraft(createBlankDraft(moduleEntry, baseRenderableSections, domainFolders[0]?.id ?? ''));
      return;
    }
    if (selectedRecord) {
      setDraft(buildDraftFromRecord(moduleEntry, selectedRecord, baseRenderableSections));
    } else if (moduleEntry) {
      setDraft(createBlankDraft(moduleEntry, baseRenderableSections, domainFolders[0]?.id ?? ''));
    } else {
      setDraft(null);
    }
  }, [isCreating, selectedRecord, moduleEntry, baseRenderableSections, domainFolders]);

  useEffect(() => {
    if (!draft) {
      return;
    }
    setDraft((current) => {
      if (!current) {
        return current;
      }
      if (JSON.stringify(current.data) === runtimeDataSignature) {
        return current;
      }
      const nextStatus =
        typeof formRuntime.data.status === 'string' && formRuntime.data.status.trim()
          ? formRuntime.data.status.trim()
          : current.status;
      return {
        ...current,
        status: nextStatus,
        data: formRuntime.data,
      };
    });
  }, [draft, formRuntime.data, runtimeDataSignature]);

  async function saveRecord() {
    if (!moduleEntry || !draft) {
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      if (formRuntime.errors.length > 0) {
        throw new Error(`Resolve Form Builder validation before saving: ${formRuntime.errors[0].message}`);
      }
      const payload = buildPayloadFromDraft({
        ...draft,
        status:
          typeof formRuntime.data.status === 'string' && formRuntime.data.status.trim()
            ? formRuntime.data.status.trim()
            : draft.status,
        data: formRuntime.data,
      });
      if (!payload.folderId) {
        throw new Error('Select a domain before saving this record.');
      }
      const saved = isCreating || !selectedRecord
        ? await createModuleRecord(moduleEntry.moduleKey, payload)
        : await updateModuleRecord(moduleEntry.moduleKey, selectedRecord.id, payload);
      setNotice(isCreating ? `${moduleEntry.moduleName} record created.` : `${moduleEntry.moduleName} record updated.`);
      setIsCreating(false);
      setSelectedRecordId(saved.id);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('record', saved.id);
        next.delete('create');
        return next;
      }, { replace: true });
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the current module record.');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRecord() {
    if (!moduleEntry || !selectedRecord) {
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await archiveModuleRecord(moduleEntry.moduleKey, selectedRecord.id);
      setNotice(`${moduleEntry.moduleName} record archived.`);
      setSelectedRecordId(null);
      setIsCreating(false);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('record');
        next.delete('create');
        return next;
      }, { replace: true });
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive the current record.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading tenant module workspace...</div>;
  }

  if (!moduleEntry) {
    return <div className="notice-error">The requested module is not available in this tenant workspace.</div>;
  }

  if (moduleEntry.implementationType !== 'shared-workspace') {
    return (
      <div className="space-y-6">
        <section className="panel">
          <div className="eyebrow">Modules</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{moduleEntry.pluralName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {moduleEntry.pluralName} use a stronger tenant-facing surface outside the shared records workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="button-primary" to={moduleEntry.canonicalRoute}>
              {moduleEntry.primaryAction}
            </Link>
            <Link className="button-secondary" to="/modules">
              Back to module directory
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Modules</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{moduleEntry.pluralName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{moduleEntry.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="button-primary"
              onClick={() => {
                setIsCreating(true);
                setSelectedRecordId(null);
                setDraft(createBlankDraft(moduleEntry, baseRenderableSections, domainFolders[0]?.id ?? ''));
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete('record');
                  next.set('create', 'true');
                  return next;
                }, { replace: true });
              }}
              type="button"
            >
              New {moduleEntry.moduleName}
            </button>
            <Link className="button-secondary" to="/modules">
              Module directory
            </Link>
          </div>
        </div>
        {moduleGuidance ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="panel-subtle">
              <div className="eyebrow">Module Definition</div>
              <h2 className="mt-2 text-lg font-semibold text-white">What this module manages</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{moduleGuidance.definition}</p>
            </div>
            <div className="panel-subtle">
              <div className="eyebrow">How to use it</div>
              <h2 className="mt-2 text-lg font-semibold text-white">
                {moduleGuidance.usageHeading ?? 'Workspace focus'}
              </h2>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {moduleGuidance.focusAreas.map((item) => (
                  <div key={item}>- {item}</div>
                ))}
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                {moduleGuidance.relationshipHint}
              </div>
            </div>
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(workspaceMetrics ?? [
            { label: 'Active records', value: records.filter((record) => !record.archived).length },
            { label: 'Archived', value: records.filter((record) => record.archived).length },
            { label: 'Coverage', value: moduleEntry.coverageBadge },
            { label: 'Related modules', value: moduleEntry.relatedModules.length },
          ]).map((metric) => (
            <div className="metric-card" key={metric.label}>
              <div className="metric-label">{metric.label}</div>
              <div className="mt-3 text-lg font-semibold text-white">{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      {notice ? <div className="notice-success">{notice}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="space-y-6">
          <div className="panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Registry</div>
                <h2 className="mt-2 text-xl font-semibold text-white">{moduleEntry.pluralName} register</h2>
              </div>
              <div className="badge-neutral">{records.length} records</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Search</span>
                <input
                  className="input"
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                  placeholder={`Search ${moduleEntry.pluralName.toLowerCase()}...`}
                  value={filters.q}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Domain</span>
                <select
                  className="input"
                  onChange={(event) => setFilters((current) => ({ ...current, folderId: event.target.value }))}
                  value={filters.folderId}
                >
                  <option value="">All accessible domains</option>
                  {domainFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.pathLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Status</span>
                <input
                  className="input"
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  placeholder="Filter by status"
                  value={filters.status}
                />
              </label>
              <label className="mt-7 flex items-center gap-3 text-sm text-slate-300">
                <input
                  checked={filters.includeArchived}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, includeArchived: event.target.checked }))
                  }
                  type="checkbox"
                />
                Include archived records
              </label>
            </div>
          </div>

          <section className="panel space-y-3">
            {recordsLoading ? (
              <div className="text-sm text-slate-300">Loading register records...</div>
            ) : records.length === 0 ? (
              <div className="panel-subtle text-sm text-slate-300">
                {moduleGuidance?.emptyState ??
                  `No ${moduleEntry.pluralName.toLowerCase()} have been created yet. Use the shared module workspace to add the first tenant-facing record.`}
              </div>
            ) : (
              records.map((record) => (
                <button
                  className={[
                    'w-full rounded-3xl border p-4 text-left transition',
                    !isCreating && selectedRecordId === record.id
                      ? 'border-cyan-300/50 bg-cyan-400/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
                  ].join(' ')}
                  key={record.id}
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedRecordId(record.id);
                    setSearchParams((current) => {
                      const next = new URLSearchParams(current);
                      next.set('record', record.id);
                      next.delete('create');
                      return next;
                    }, { replace: true });
                  }}
                  type="button"
                >
                  {moduleRecordBadges(moduleEntry.moduleKey, record).length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {moduleRecordBadges(moduleEntry.moduleKey, record).map((badge) => (
                        <span className="badge-neutral" key={`${record.id}-${badge}`}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-white">{record.title}</div>
                    <span className={record.archived ? 'badge-neutral' : 'badge-success'}>
                      {record.status || 'draft'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {domainFolders.find((folder) => folder.id === record.folderId)?.pathLabel ?? 'Domain scope unavailable'}
                  </div>
                  {moduleRecordSecondaryText(moduleEntry.moduleKey, record) ? (
                    <div className="mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-slate-400">
                      {moduleRecordSecondaryText(moduleEntry.moduleKey, record)}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recordDateChips(record).slice(0, 3).map(([label, value]) => (
                      <span className="badge-neutral" key={`${record.id}-${label}`}>
                        {label}: {formatDate(value)}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            )}
          </section>
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">{isCreating || !selectedRecord ? 'Create Record' : 'Record Detail'}</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {isCreating || !selectedRecord ? `New ${moduleEntry.moduleName}` : selectedRecord.title}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {!isCreating && selectedRecord ? (
                  <button className="button-secondary" disabled={busy} onClick={() => void archiveRecord()} type="button">
                    Archive
                  </button>
                ) : null}
                <button className="button-primary" disabled={busy || !draft} onClick={() => void saveRecord()} type="button">
                  {busy ? 'Saving...' : isCreating || !selectedRecord ? 'Create Record' : 'Save Changes'}
                </button>
              </div>
            </div>
            {formRuntime.errors.length > 0 ? (
              <div className="notice-error mt-4">
                {formRuntime.errors.length} Form Builder validation issue{formRuntime.errors.length === 1 ? '' : 's'} must be resolved before saving.
              </div>
            ) : null}

            {draft ? (
              <div className="mt-5 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="label">Domain</span>
                    <select
                      className="input"
                      onChange={(event) => setDraft((current) => (current ? { ...current, folderId: event.target.value } : current))}
                      value={draft.folderId}
                    >
                      <option value="">Select a domain</option>
                      {domainFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.pathLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">Record status</span>
                    <input
                      className="input"
                      onChange={(event) => setDraft((current) => (current ? { ...current, status: event.target.value } : current))}
                      value={draft.status}
                    />
                  </label>
                </div>

                {renderableSections.map((section) => (
                  <div className="space-y-4" key={section.id}>
                    <div className="panel-subtle">
                      <div className="eyebrow">Schema Section</div>
                      <h3 className="mt-2 text-lg font-semibold text-white">{section.displayName}</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {section.fields.map((field) => (
                        <label
                          className={isTextAreaField(field) ? 'space-y-1 md:col-span-2' : 'space-y-1'}
                          key={field.id}
                        >
                          <span className="label">
                            {field.displayName}
                            {field.required ? ' *' : ''}
                          </span>
                          {isSelectField(field) ? (
                            <select
                              className="input"
                              disabled={!field.editable}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        status:
                                          field.systemName === 'status' ? event.target.value : current.status,
                                        data: {
                                          ...current.data,
                                          [field.systemName]: event.target.value,
                                        },
                                      }
                                    : current,
                                )
                              }
                              value={normalizeText(draft.data[field.systemName])}
                            >
                              <option value="">Not set</option>
                              {field.choices.map((choice) => (
                                <option key={choice} value={choice}>
                                  {choice}
                                </option>
                              ))}
                            </select>
                          ) : isTextAreaField(field) ? (
                            <textarea
                              className="input min-h-[120px]"
                              disabled={!field.editable}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        data: {
                                          ...current.data,
                                          [field.systemName]: event.target.value,
                                        },
                                      }
                                    : current,
                                )
                              }
                              value={normalizeText(draft.data[field.systemName])}
                            />
                          ) : isBooleanField(field) ? (
                            <label className="mt-3 flex items-center gap-3 text-sm text-slate-300">
                              <input
                                checked={Boolean(draft.data[field.systemName])}
                                disabled={!field.editable}
                                onChange={(event) =>
                                  setDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          data: {
                                            ...current.data,
                                            [field.systemName]: event.target.checked,
                                          },
                                        }
                                      : current,
                                  )
                                }
                                type="checkbox"
                              />
                              Enabled
                            </label>
                          ) : (
                            <input
                              className="input"
                              disabled={!field.editable}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        status:
                                          field.systemName === 'status' ? event.target.value : current.status,
                                        data: {
                                          ...current.data,
                                          [field.systemName]: isNumericField(field)
                                            ? event.target.value
                                              ? Number(event.target.value)
                                              : ''
                                            : event.target.value,
                                        },
                                      }
                                    : current,
                                )
                              }
                              type={isDateField(field) ? 'date' : isNumericField(field) ? 'number' : 'text'}
                              value={
                                isNumericField(field)
                                  ? draft.data[field.systemName] === ''
                                    ? ''
                                    : String(draft.data[field.systemName] ?? '')
                                  : normalizeText(draft.data[field.systemName])
                              }
                            />
                          )}
                          {field.helpText ? <div className="text-xs text-slate-500">{field.helpText}</div> : null}
                          {!field.editable ? <div className="text-xs text-slate-500">Read-only by Form Builder rule.</div> : null}
                          {field.errors.map((message) => (
                            <div className="text-xs text-rose-200" key={`${field.systemName}-${message}`}>
                              {message}
                            </div>
                          ))}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="eyebrow">Relationships</div>
                      <h3 className="mt-2 text-lg font-semibold text-white">Linked records and evidence</h3>
                    </div>
                    <button
                      className="button-secondary"
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                links: [
                                  ...current.links,
                                  {
                                    id: crypto.randomUUID(),
                                    relationType: 'evidence',
                                    targetType: 'route',
                                    targetId: null,
                                    label: '',
                                    route: '',
                                  },
                                ],
                              }
                            : current,
                        )
                      }
                      type="button"
                    >
                      Add link
                    </button>
                  </div>
                  {moduleGuidance?.relationshipPresets?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {moduleGuidance.relationshipPresets.map((preset) => (
                        <button
                          className="button-secondary"
                          key={`${preset.relationType}-${preset.label}`}
                          onClick={() =>
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    links: [
                                      ...current.links,
                                      {
                                        id: crypto.randomUUID(),
                                        relationType: preset.relationType,
                                        targetType: 'route',
                                        targetId: null,
                                        label: preset.label,
                                        route: preset.route,
                                      },
                                    ],
                                  }
                                : current,
                            )
                          }
                          type="button"
                        >
                          Add {preset.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {draft.links.length === 0 ? (
                    <div className="panel-subtle text-sm text-slate-400">
                      Add evidence, assessment, task, or cross-module links so this record can participate in related workflows.
                    </div>
                  ) : (
                    draft.links.map((link, index) => (
                      <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3" key={link.id}>
                        <label className="space-y-1">
                          <span className="label">Relationship</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      links: current.links.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, relationType: event.target.value } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            value={link.relationType}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="label">Label</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      links: current.links.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, label: event.target.value } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            value={link.label}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="label">Route</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      links: current.links.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, route: event.target.value } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            placeholder="/assessments"
                            value={link.route ?? ''}
                          />
                        </label>
                      </div>
                    ))
                  )}
                </div>

                <label className="space-y-1">
                  <span className="label">Activity note</span>
                  <textarea
                    className="input min-h-[120px]"
                    onChange={(event) => setDraft((current) => (current ? { ...current, note: event.target.value } : current))}
                    value={draft.note}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            {highlights.length > 0 ? (
              <div className="panel-subtle xl:col-span-2">
                <div className="eyebrow">Module Summary</div>
                <h3 className="mt-2 text-lg font-semibold text-white">Capability posture</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {highlights.map((highlight) => (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4" key={highlight.title + highlight.body}>
                      {highlight.eyebrow ? (
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{highlight.eyebrow}</div>
                      ) : null}
                      <div className="mt-2 font-medium text-white">{highlight.title}</div>
                      <div className="mt-3 text-sm leading-6 text-slate-300">{highlight.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="panel-subtle">
              <div className="eyebrow">Quick Actions</div>
              <h3 className="mt-2 text-lg font-semibold text-white">Builder and reporting hooks</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link className="button-secondary" to={`/builders/form-builder?moduleKey=${encodeURIComponent(moduleEntry.moduleKey)}`}>
                  Form Builder
                </Link>
                <Link className="button-secondary" to={`/builders/rules-builder?moduleKey=${encodeURIComponent(moduleEntry.moduleKey)}`}>
                  Rules Builder
                </Link>
                <Link className="button-secondary" to="/builders/export-builder">
                  Export Builder
                </Link>
                <Link className="button-secondary" to="/builders/report-builder">
                  Report Builder
                </Link>
                <Link className="button-secondary" to="/builders/dashboard-builder">
                  Dashboard Builder
                </Link>
                <Link className="button-secondary" to="/builders/questionnaire-builder">
                  Questionnaire Builder
                </Link>
                <Link className="button-secondary" to="/builders/wayfinder-builder">
                  Wayfinder Builder
                </Link>
                {moduleEntry.relatedModules.includes('assessments') ? (
                  <Link className="button-secondary" to="/assessments">
                    Assessments
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="panel-subtle">
              <div className="eyebrow">Related Modules</div>
              <h3 className="mt-2 text-lg font-semibold text-white">Program context</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {moduleEntry.relatedModules.map((related) => (
                  <Link className="badge-neutral transition hover:text-white" key={related} to={`/modules/${related}`}>
                    {related}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="panel-subtle">
              <div className="eyebrow">Evidence</div>
              <h3 className="mt-2 text-lg font-semibold text-white">Evidence links</h3>
              <div className="mt-4 space-y-3">
                {(selectedRecord?.links ?? []).filter((link) => link.relationType.toLowerCase().includes('evidence')).length === 0 ? (
                  <div className="text-sm text-slate-400">No evidence links recorded yet.</div>
                ) : (
                  (selectedRecord?.links ?? [])
                    .filter((link) => link.relationType.toLowerCase().includes('evidence'))
                    .map((link) => (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4" key={link.id}>
                        <div className="font-medium text-white">{link.label || 'Evidence link'}</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{link.relationType}</div>
                        {link.route ? (
                          <Link className="mt-3 inline-flex text-sm text-cyan-200 transition hover:text-cyan-100" to={link.route}>
                            Open route
                          </Link>
                        ) : null}
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="panel-subtle">
              <div className="eyebrow">Activity</div>
              <h3 className="mt-2 text-lg font-semibold text-white">Timeline and audit notes</h3>
              <div className="mt-4 space-y-3">
                {(selectedRecord?.activity ?? []).length === 0 ? (
                  <div className="text-sm text-slate-400">No activity has been recorded yet.</div>
                ) : (
                  (selectedRecord?.activity ?? []).map((entry) => (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4" key={entry.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium capitalize text-white">{entry.type}</div>
                        <div className="text-xs text-slate-500">{formatTimestamp(entry.createdAt)}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{entry.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </section>
      </section>
    </div>
  );
}
