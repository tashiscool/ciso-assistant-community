import { ApiClient } from '../../shared/api/client';
import type {
  QuestionnaireBuilderDetailResponse,
  QuestionnaireInstance,
  QuestionnaireQuestion,
  QuestionnaireRule,
  QuestionnaireTemplateKind,
  QuestionnaireTemplateSummary,
  RuleValidationResult,
  RuleSetDetail,
  RuleTestRun,
} from './types';

const client = new ApiClient();

export async function listQuestionnaireTemplates(): Promise<QuestionnaireTemplateSummary[]> {
  const response = await client.get<{ data: { templates: QuestionnaireTemplateSummary[] } }>('/builders/questionnaires');
  return response.data.templates;
}

export async function createQuestionnaireTemplate(body?: {
  name?: string;
  description?: string | null;
  audience?: string | null;
  templateKind?: QuestionnaireTemplateKind;
  sourceFramework?: string | null;
  usageNotes?: string | null;
  questionnaireType?: string | null;
  assignmentModel?: string | null;
  relatedWorkflow?: string | null;
  attestationScope?: string | null;
  responseOwnerModel?: string | null;
  evidenceCollectionMode?: string | null;
  fileUploadGuidance?: string | null;
  exportMode?: string | null;
  distributionCadence?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  profile?: string | null;
  instructions?: string | null;
  allowPublicUrl?: boolean;
  loginRequired?: boolean;
  enableScoring?: boolean;
  enableQuestionAssignment?: boolean;
}): Promise<QuestionnaireBuilderDetailResponse> {
  const response = await client.post<{ data: QuestionnaireBuilderDetailResponse }>('/builders/questionnaires', body ?? {});
  return response.data;
}

export async function getQuestionnaireTemplate(questionnaireId: string): Promise<QuestionnaireBuilderDetailResponse> {
  const response = await client.get<{ data: QuestionnaireBuilderDetailResponse }>(`/builders/questionnaires/${questionnaireId}`);
  return response.data;
}

export async function saveQuestionnaireTemplate(
  questionnaireId: string,
  body: {
    name: string;
    description: string | null;
    status: string;
    templateKind: QuestionnaireTemplateKind;
    scoringMode: string;
    audience: string | null;
    sourceFramework?: string | null;
    usageNotes?: string | null;
    questionnaireType?: string | null;
    assignmentModel?: string | null;
    relatedWorkflow?: string | null;
    attestationScope?: string | null;
    responseOwnerModel?: string | null;
    evidenceCollectionMode?: string | null;
    fileUploadGuidance?: string | null;
    exportMode?: string | null;
    distributionCadence?: string | null;
    ownerUserId?: string | null;
    ownerName?: string | null;
    profile?: string | null;
    instructions?: string | null;
    allowPublicUrl?: boolean;
    loginRequired?: boolean;
    enableScoring?: boolean;
    enableQuestionAssignment?: boolean;
    questions: QuestionnaireQuestion[];
  },
): Promise<QuestionnaireBuilderDetailResponse> {
  const response = await client.put<{ data: QuestionnaireBuilderDetailResponse }>(
    `/builders/questionnaires/${questionnaireId}`,
    body,
  );
  return response.data;
}

export async function saveQuestionnaireRules(
  questionnaireId: string,
  body: {
    name: string;
    rules: QuestionnaireRule[];
  },
): Promise<RuleSetDetail> {
  const response = await client.put<{ data: RuleSetDetail }>(`/builders/questionnaires/${questionnaireId}/rules`, body);
  return response.data;
}

export async function runQuestionnaireRuleTest(
  questionnaireId: string,
  body: {
    scenarioName: string;
    answers: Record<string, string | number | boolean | string[]>;
  },
): Promise<RuleTestRun> {
  const response = await client.post<{ data: RuleTestRun }>(
    `/builders/questionnaires/${questionnaireId}/test-runs`,
    body,
  );
  return response.data;
}

export async function validateQuestionnaireRules(
  questionnaireId: string,
  body: {
    rules: QuestionnaireRule[];
    questions: QuestionnaireQuestion[];
  },
): Promise<RuleValidationResult> {
  const response = await client.post<{ data: RuleValidationResult }>(
    `/builders/questionnaires/${questionnaireId}/validate`,
    body,
  );
  return response.data;
}

export async function previewQuestionnaireRuleTest(
  questionnaireId: string,
  body: {
    scenarioName: string;
    answers: Record<string, string | number | boolean | string[]>;
    draftRules: QuestionnaireRule[];
    draftQuestions: QuestionnaireQuestion[];
  },
): Promise<RuleTestRun> {
  const response = await client.post<{ data: RuleTestRun }>(
    `/builders/questionnaires/${questionnaireId}/test-preview`,
    body,
  );
  return response.data;
}

export async function importQuestionnaireTemplate(body: {
  template: Partial<QuestionnaireBuilderDetailResponse['template']>;
  rules?: QuestionnaireRule[];
}): Promise<QuestionnaireBuilderDetailResponse> {
  const response = await client.post<{ data: QuestionnaireBuilderDetailResponse }>('/builders/questionnaires/import', body);
  return response.data;
}

export async function exportQuestionnaireTemplate(questionnaireId: string): Promise<unknown> {
  const response = await client.get<{ data: unknown }>(`/builders/questionnaires/${questionnaireId}/export`);
  return response.data;
}

export async function listQuestionnaireInstances(questionnaireId: string): Promise<QuestionnaireInstance[]> {
  const response = await client.get<{ data: { instances: QuestionnaireInstance[] } }>(
    `/builders/questionnaires/${questionnaireId}/instances`,
  );
  return response.data.instances;
}

export async function createQuestionnaireAssignment(
  questionnaireId: string,
  body: {
    assignmentType: 'user' | 'email' | 'module' | 'self' | 'recurring' | 'bulk';
    title?: string;
    assigneeUserId?: string | null;
    assigneeEmail?: string | null;
    assigneeEmails?: string[];
    bulkCsv?: string | null;
    reviewerUserId?: string | null;
    parentModule?: string | null;
    parentRecordId?: string | null;
    dueDate?: string | null;
    recurrenceType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    loginRequired?: boolean;
  },
): Promise<QuestionnaireInstance[]> {
  const response = await client.post<{ data: { instances: QuestionnaireInstance[] } }>(
    `/builders/questionnaires/${questionnaireId}/assignments`,
    body,
  );
  return response.data.instances;
}

export async function saveQuestionnaireInstanceResponses(
  questionnaireId: string,
  instanceId: string,
  body: {
    answers?: Record<string, unknown>;
    uploads?: Record<string, unknown>;
    headerValues?: Record<string, unknown>;
    comment?: string | null;
  },
): Promise<QuestionnaireInstance> {
  const response = await client.put<{ data: QuestionnaireInstance }>(
    `/builders/questionnaires/${questionnaireId}/instances/${instanceId}/responses`,
    body,
  );
  return response.data;
}

export async function runQuestionnaireInstanceAction(
  questionnaireId: string,
  instanceId: string,
  action: 'submit' | 'accept' | 'reject' | 'reopen' | 'close' | 'feedback',
  body?: {
    feedback?: Record<string, { rating?: string | null; comment?: string | null }>;
    reviewerComments?: string | null;
    sendEmail?: boolean;
  },
): Promise<QuestionnaireInstance> {
  const response = await client.post<{ data: QuestionnaireInstance }>(
    `/builders/questionnaires/${questionnaireId}/instances/${instanceId}/${action}`,
    body ?? {},
  );
  return response.data;
}

export async function deleteQuestionnaireInstance(questionnaireId: string, instanceId: string): Promise<void> {
  await client.delete<{ data: { deleted: boolean } }>(`/builders/questionnaires/${questionnaireId}/instances/${instanceId}`);
}

export async function exportQuestionnaireInstance(questionnaireId: string, instanceId: string): Promise<unknown> {
  const response = await client.get<{ data: unknown }>(
    `/builders/questionnaires/${questionnaireId}/instances/${instanceId}/export`,
  );
  return response.data;
}
