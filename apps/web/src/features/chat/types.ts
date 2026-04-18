export type ChatCitation = {
  label: string;
  value: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  citations?: ChatCitation[];
};

export type ChatSession = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  title: string;
  workflow: string;
  status: string;
  messageCount: number;
  lastMessagePreview: string;
  messages: ChatMessage[];
  citations: Array<Record<string, unknown>>;
  workflowState: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ChatStatus = {
  available: boolean;
  provider: string;
  sessionsCount: number;
};
