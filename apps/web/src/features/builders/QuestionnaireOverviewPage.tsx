import { QuestionnaireBuilderWorkspace } from './QuestionnaireBuilderWorkspace';

type QuestionnaireOverviewPageProps = {
  workspaceMode?: 'all' | 'assessment-plans' | 'questionnaires';
};

export function QuestionnaireOverviewPage({ workspaceMode = 'all' }: QuestionnaireOverviewPageProps) {
  return <QuestionnaireBuilderWorkspace initialTab="overview" workspaceMode={workspaceMode} />;
}
