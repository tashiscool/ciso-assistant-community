import { QuestionnaireBuilderWorkspace } from './QuestionnaireBuilderWorkspace';

type QuestionnaireBuilderPageProps = {
  workspaceMode?: 'all' | 'assessment-plans' | 'questionnaires';
};

export function QuestionnaireBuilderPage({ workspaceMode = 'all' }: QuestionnaireBuilderPageProps) {
  return <QuestionnaireBuilderWorkspace initialTab="builder" workspaceMode={workspaceMode} />;
}
