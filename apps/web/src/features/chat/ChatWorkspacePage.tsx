import { useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { ChatSession, ChatStatus } from './types';

const client = new ApiClient();

function formatDate(value: string) {
  return new Date(value).toLocaleTimeString();
}

export function ChatWorkspacePage() {
  const { identity } = useEdgeIdentity();
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [folderId, setFolderId] = useState('');
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');

  async function loadChat() {
    try {
      setLoading(true);
      setError(null);
      const [statusResponse, folderResponse, sessionResponse] = await Promise.all([
        client.get<{ data: ChatStatus }>('/ops/chat/status'),
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: ChatSession[] }>('/ops/chat/sessions'),
      ]);
      setStatus(statusResponse.data);
      setFolders(folderResponse.data);
      setSessions(sessionResponse.data);

      if (!folderId && folderResponse.data[0]?.id) {
        setFolderId(folderResponse.data[0].id);
      }

      const targetSession = selectedSession
        ? sessionResponse.data.find((session) => session.id === selectedSession.id) ?? sessionResponse.data[0] ?? null
        : sessionResponse.data[0] ?? null;
      setSelectedSession(targetSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChat();
  }, [identity.tenantId, identity.userId]);

  async function createSession() {
    try {
      setBusy(true);
      setError(null);
      const response = await client.post<{ data: ChatSession }>('/ops/chat/sessions', {
        folderId,
        title,
      });
      setTitle('');
      await loadChat();
      setSelectedSession(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!selectedSession || !draft.trim()) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      const response = await client.post<{ data: { session: ChatSession } }>(
        `/ops/chat/sessions/${selectedSession.id}/messages`,
        {
          content: draft,
        },
      );
      setDraft('');
      setSelectedSession(response.data.session);
      await loadChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading chat workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="eyebrow">Chat</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Workspace Guidance Chat</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Open a tenant-scoped conversation to query the local governance and risk workspace while
            the Cloudflare migration keeps replacing the older chat surface.
          </p>
        </div>
        <div className="panel-subtle grid gap-3 sm:grid-cols-3">
          <div className="metric-card">
            <div className="metric-label">Provider</div>
            <div className="mt-3 text-sm font-semibold text-white">{status?.provider ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Sessions</div>
            <div className="metric-value">{status?.sessionsCount ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Ready</div>
            <div className="mt-3 text-sm font-semibold text-white">{status?.available ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="panel">
          <div className="eyebrow">Sessions</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createSession();
            }}
          >
            <label className="space-y-1">
              <span className="label">Domain</span>
              <select className="input" onChange={(event) => setFolderId(event.target.value)} value={folderId}>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Session title</span>
              <input className="input" onChange={(event) => setTitle(event.target.value)} value={title} />
            </label>
            <button className="button-primary" disabled={busy} type="submit">
              {busy ? 'Creating...' : 'Create Session'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                className={`panel-subtle block w-full text-left transition ${
                  selectedSession?.id === session.id ? 'border-cyan-300/30 bg-cyan-400/[0.03]' : ''
                }`}
                onClick={() => setSelectedSession(session)}
                type="button"
              >
                <div className="font-medium text-white">{session.title || 'Untitled session'}</div>
                <div className="mt-1 text-xs text-slate-500">{session.folderName}</div>
                <div className="mt-3 text-sm text-slate-300">{session.lastMessagePreview || 'No messages yet.'}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel flex min-h-[560px] flex-col">
          <div className="eyebrow">Conversation</div>
          {selectedSession ? (
            <>
              <div className="mt-4 flex-1 space-y-4 overflow-auto pr-1">
                {selectedSession.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-3xl px-4 py-4 ${
                      message.role === 'assistant'
                        ? 'bg-cyan-500/10 text-cyan-50'
                        : 'bg-slate-900/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{message.role}</div>
                      <div className="text-xs text-slate-500">{formatDate(message.createdAt)}</div>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.citations.map((citation) => (
                          <span key={`${citation.label}-${citation.value}`} className="badge-neutral">
                            {citation.label}: {citation.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form
                className="mt-6 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
              >
                <textarea
                  className="input min-h-[110px]"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about risk, privacy, vendors, EBIOS, or quantitative studies..."
                  value={draft}
                />
                <button className="button-primary" disabled={busy || !draft.trim()} type="submit">
                  {busy ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </>
          ) : (
            <div className="mt-4 text-sm text-slate-400">Create a session to start a conversation.</div>
          )}
        </section>
      </section>
    </div>
  );
}
