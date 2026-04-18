import { ApiClient } from '../../shared/api/client';
import type {
  QuestionnaireBuilderDetailResponse,
  QuestionnaireQuestion,
  QuestionnaireRule,
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
    scoringMode: string;
    audience: string | null;
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
