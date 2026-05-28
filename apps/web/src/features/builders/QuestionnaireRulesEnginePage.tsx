import { QuestionnaireBuilderWorkspace } from './QuestionnaireBuilderWorkspace';

type QuestionnaireRulesEnginePageProps = {
  workspaceMode?: 'all' | 'assessment-plans' | 'questionnaires';
};

export function QuestionnaireRulesEnginePage({ workspaceMode = 'all' }: QuestionnaireRulesEnginePageProps) {
  return <QuestionnaireBuilderWorkspace initialTab="rules" workspaceMode={workspaceMode} />;
}
