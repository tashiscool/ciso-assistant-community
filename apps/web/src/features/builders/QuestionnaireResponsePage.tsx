import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import type { QuestionnaireInstance, QuestionnaireQuestion } from './types';

const client = new ApiClient();

type PublicQuestionnaireShell = {
  title: string;
  templateName: string;
  status: string;
  dueDate: string | null;
  loginRequired: boolean;
  questions: Array<Pick<QuestionnaireQuestion, 'ref' | 'prompt' | 'type' | 'section' | 'required' | 'options' | 'helpText' | 'evidenceHint' | 'enableUpload'>>;
  runtime?: QuestionnaireInstance['runtime'];
};

export function QuestionnaireResponsePage() {
  const { shareToken } = useParams();
  const [shell, setShell] = useState<PublicQuestionnaireShell | null>(null);
  const [instance, setInstance] = useState<QuestionnaireInstance | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploads, setUploads] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadShell() {
      if (!shareToken) return;
      try {
        setLoading(true);
        const response = await client.get<{ data: PublicQuestionnaireShell }>(`/builders/questionnaire-access/${shareToken}`);
        setShell(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load questionnaire response link.');
      } finally {
        setLoading(false);
      }
    }
    void loadShell();
  }, [shareToken]);

  async function validateAccessCode() {
    if (!shareToken) return;
    try {
      setSaving(true);
      setError(null);
      const response = await client.post<{ data: QuestionnaireInstance }>(`/builders/questionnaire-access/${shareToken}/validate`, { accessCode });
      setInstance(response.data);
      setAnswers(response.data.answers ?? {});
      setUploads(response.data.uploads ?? {});
      setNotice('Access code accepted. You can now complete the questionnaire.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to validate access code.');
    } finally {
      setSaving(false);
    }
  }

  async function saveResponses(submit = false) {
    if (!shareToken) return;
    try {
      setSaving(true);
      setError(null);
      const response = await client.put<{ data: QuestionnaireInstance }>(`/builders/questionnaire-access/${shareToken}/responses`, {
        accessCode,
        answers,
        uploads,
      });
      setInstance(response.data);
      setAnswers(response.data.answers ?? {});
      setUploads(response.data.uploads ?? {});
      if (submit) {
        const submitted = await client.post<{ data: QuestionnaireInstance }>(`/builders/questionnaire-access/${shareToken}/submit`, { accessCode });
        setInstance(submitted.data);
        setAnswers(submitted.data.answers ?? {});
        setUploads(submitted.data.uploads ?? {});
        setNotice('Questionnaire submitted. Answers are now locked for review.');
      } else {
        setNotice('Progress saved.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save questionnaire response.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading questionnaire response...</div>;
  }

  if (!shell) {
    return <div className="notice-error">{error ?? 'Questionnaire response link was not found.'}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="panel">
        <div className="eyebrow">Questionnaire Response</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">{shell.title}</h1>
        <p className="mt-3 text-sm text-slate-300">
          {shell.templateName} · {shell.status} · Due {shell.dueDate ?? 'not set'}
        </p>
      </section>

      {notice ? <div className="notice-success">{notice}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}

      {!instance ? (
        <section className="panel max-w-xl">
          <div className="eyebrow">Access Code Login</div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Enter the access code from your questionnaire email to open this response without a Regovise user account.
          </p>
          <input className="input mt-4" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="9-digit access code" />
          <button className="button-primary mt-4" disabled={saving || accessCode.trim().length < 6} onClick={() => void validateAccessCode()} type="button">
            Validate
          </button>
        </section>
      ) : (
        <section className="panel space-y-5">
          {(() => {
            const runtime = instance.runtime ?? shell.runtime;
            const hiddenQuestions = new Set(runtime?.hiddenQuestions ?? []);
            const disabledQuestions = new Set(runtime?.disabledQuestions ?? []);
            const requiredQuestions = new Set(runtime?.requiredQuestions ?? []);
            const validationErrors = runtime?.validationErrors ?? [];
            const renderedQuestions = shell.questions.filter((question) => !hiddenQuestions.has(question.ref));
            return (
              <>
          <div className="flex flex-wrap gap-2">
            <span className="badge-neutral">{instance.status}</span>
            <span className="badge-neutral">{Math.round(instance.percentComplete)}% complete</span>
            <span className="badge-success">{instance.passingStatus}</span>
            {runtime?.displayOptions?.displayscore ? <span className="badge-neutral">Score {instance.score}/{instance.maxScore}</span> : null}
            {runtime?.displayOptions?.displaygrade ? <span className="badge-neutral">Grade {instance.grade ?? 'Pending'}</span> : null}
          </div>
          {validationErrors.length > 0 ? (
            <div className="notice-error">
              {validationErrors.map((validation) => (
                <div key={`${validation.ref}-${validation.message}`}>{validation.message}</div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {renderedQuestions.map((question) => {
              const locked = !['Open', 'RequestChanges'].includes(instance.status) || disabledQuestions.has(question.ref);
              const required = requiredQuestions.has(question.ref);
              return (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4" key={question.ref}>
                <div className="font-medium text-white">
                  {question.prompt}
                  {required ? <span className="ml-1 text-rose-300">*</span> : null}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{question.section}</div>
                {question.helpText ? <p className="mt-3 text-sm text-slate-400">{question.helpText}</p> : null}
                <div className="mt-4">
                  {question.type === 'boolean' ? (
                    <select className="input" disabled={locked} value={String(answers[question.ref] ?? false)} onChange={(event) => setAnswers((current) => ({ ...current, [question.ref]: event.target.value === 'true' }))}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : question.type === 'single-select' ? (
                    <select className="input" disabled={locked} value={String(answers[question.ref] ?? '')} onChange={(event) => setAnswers((current) => ({ ...current, [question.ref]: event.target.value }))}>
                      {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : question.type === 'instructional' ? (
                    <div className="rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.04] p-3 text-sm text-slate-300">{question.evidenceHint ?? question.prompt}</div>
                  ) : (
                    <textarea className="input min-h-[88px]" disabled={locked} value={String(answers[question.ref] ?? '')} onChange={(event) => setAnswers((current) => ({ ...current, [question.ref]: event.target.value }))} />
                  )}
                </div>
                {(question.enableUpload || question.type === 'file-upload') && (
                  <textarea className="input mt-4 min-h-[72px]" disabled={locked} value={String(uploads[question.ref] ?? '')} onChange={(event) => setUploads((current) => ({ ...current, [question.ref]: event.target.value }))} placeholder="Evidence file name, URL, or artifact reference" />
                )}
              </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={saving || !['Open', 'RequestChanges'].includes(instance.status)} onClick={() => void saveResponses(false)} type="button">
              Save
            </button>
            <button className="button-primary" disabled={saving || !['Open', 'RequestChanges'].includes(instance.status)} onClick={() => void saveResponses(true)} type="button">
              Submit
            </button>
          </div>
              </>
            );
          })()}
        </section>
      )}
    </div>
  );
}
