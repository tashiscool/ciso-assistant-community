import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RegModal, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import type { QuestionnaireInstance, QuestionnaireQuestion } from './types';

const client = new ApiClient();

type PublicTableColumn = {
  id: string;
  title: string;
  dataType: 'text' | 'number' | 'date' | 'dropdown';
  required: boolean;
  options?: Array<{ value: string }>;
};

type PublicQuestionnaireShell = {
  title: string;
  templateName: string;
  status: string;
  dueDate: string | null;
  loginRequired: boolean;
  questions: Array<Pick<QuestionnaireQuestion, 'ref' | 'prompt' | 'type' | 'section' | 'required' | 'options' | 'helpText' | 'evidenceHint' | 'enableUpload'> & { tableColumns?: PublicTableColumn[] }>;
  runtime?: QuestionnaireInstance['runtime'];
};

function passingTone(status: string) {
  return status === 'Passing' ? 'success' : status === 'Failing' ? 'danger' : 'neutral';
}

function renderStoredResponse(value: unknown, fieldId: string, labelId: string, message: string, invalid = false) {
  return (
    <>
      <p className={invalid ? 'notice-error mb-3' : 'mb-3 text-sm text-[#6f6578]'} id={`${fieldId}-message`} role={invalid ? 'alert' : undefined}>{message}</p>
      <pre
        aria-describedby={`${fieldId}-message`}
        aria-labelledby={labelId}
        className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-3 text-sm text-[#4f435c]"
        id={fieldId}
        role="region"
        tabIndex={0}
      >
        {value === undefined ? 'No response provided.' : JSON.stringify(value, null, 2)}
      </pre>
    </>
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function editableTable(columns: PublicTableColumn[] | undefined, value: unknown) {
  if (!Array.isArray(columns) || columns.length === 0 || !columns.every((column) =>
    column && typeof column.id === 'string' && column.id.trim() && typeof column.title === 'string' && column.title.trim() &&
    typeof column.required === 'boolean' && ['text', 'number', 'date', 'dropdown'].includes(column.dataType) &&
    (column.dataType !== 'dropdown' || (Array.isArray(column.options) && column.options.length > 0 && column.options.every((option) => option && typeof option.value === 'string')))
  ) || new Set(columns.map((column) => column.id)).size !== columns.length) return null;
  const rows = value === undefined ? [] : value;
  if (!Array.isArray(rows) || !rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row) && columns.every((column) => {
    const cell = row[column.id];
    if (cell === undefined || cell === '') return true;
    if (column.dataType === 'number') return typeof cell === 'number' && Number.isFinite(cell);
    if (typeof cell !== 'string') return false;
    if (column.dataType === 'date') return isIsoDate(cell);
    if (column.dataType === 'dropdown') return column.options?.some((option) => option.value === cell);
    return true;
  }))) return null;
  return { columns, rows: rows as Array<Record<string, unknown>> };
}

function QuestionnaireTableEditor({ columns, rows, fieldId, labelId, prompt, locked, onChange }: {
  columns: PublicTableColumn[];
  rows: Array<Record<string, unknown>>;
  fieldId: string;
  labelId: string;
  prompt: string;
  locked: boolean;
  onChange: (rows: Array<Record<string, unknown>>) => void;
}) {
  function updateCell(rowIndex: number, columnId: string, value: string | number) {
    onChange(rows.map((row, index) => index === rowIndex ? { ...row, [columnId]: value } : row));
  }
  return (
    <div aria-labelledby={labelId} className="space-y-3" id={fieldId} role="group">
      <div className="relative max-w-full overflow-x-auto rounded-lg border border-[#ded8e4]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#fbf9fc] text-[#4f435c]">
            <tr>
              <th className="px-3 py-2" scope="col">Row</th>
              {columns.map((column) => <th className="min-w-[160px] px-3 py-2" key={column.id} scope="col">{column.title}{column.required ? ' *' : ''}</th>)}
              <th className="px-3 py-2" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr className="border-t border-[#ded8e4]" key={rowIndex}>
                <th className="px-3 py-2" scope="row">{rowIndex + 1}</th>
                {columns.map((column) => {
                  const cellId = `${fieldId}-row-${rowIndex}-${column.id}`;
                  const cell = row[column.id] as string | number | undefined;
                  return (
                    <td className="px-3 py-2" key={column.id}>
                      <label className="sr-only" htmlFor={cellId}>{prompt}, row {rowIndex + 1}, {column.title}</label>
                      {column.dataType === 'dropdown' ? (
                        <select className="input" disabled={locked} id={cellId} onChange={(event) => updateCell(rowIndex, column.id, event.target.value)} required={column.required} value={cell ?? ''}>
                          <option value="">Select an option</option>
                          {column.options?.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
                        </select>
                      ) : (
                        <input
                          className="input"
                          disabled={locked}
                          id={cellId}
                          onInput={column.dataType === 'date' ? (event) => {
                            const next = event.currentTarget.value;
                            if (next === '' || isIsoDate(next)) updateCell(rowIndex, column.id, next);
                          } : undefined}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (column.dataType === 'number') {
                              if (next === '') updateCell(rowIndex, column.id, '');
                              else if (Number.isFinite(Number(next))) updateCell(rowIndex, column.id, Number(next));
                            } else if (column.dataType !== 'date' || next === '' || isIsoDate(next)) updateCell(rowIndex, column.id, next);
                          }}
                          required={column.required}
                          step={column.dataType === 'number' ? 'any' : undefined}
                          type={column.dataType === 'number' ? 'number' : column.dataType === 'date' ? 'date' : 'text'}
                          value={cell ?? ''}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <button aria-label={`Remove row ${rowIndex + 1} from ${prompt}`} className="button-secondary" disabled={locked} onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))} type="button">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="text-sm text-[#6f6578]">No rows yet. Add a row to respond.</p> : null}
      <button aria-label={`Add row to ${prompt}`} className="button-secondary" disabled={locked} onClick={() => onChange([...rows, Object.fromEntries(columns.map((column) => [column.id, '']))])} type="button">Add row</button>
    </div>
  );
}

function isQuestionnaireLoginRequired(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const apiError = error as Error & { status?: number; code?: string };
  return apiError.status === 401 && apiError.code === 'questionnaire_login_required';
}

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
  const [loginRequiredError, setLoginRequiredError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSubmitReview, setPendingSubmitReview] = useState(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let cancelled = false;
    requestGeneration.current += 1;
    setShell(null);
    setInstance(null);
    setAnswers({});
    setUploads({});
    setAccessCode('');
    setNotice(null);
    setError(null);
    setLoginRequiredError(false);
    setSaving(false);
    setPendingSubmitReview(false);
    async function loadShell() {
      if (!shareToken) {
        setError('Questionnaire response link was not found.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await client.get<{ data: PublicQuestionnaireShell }>(`/builders/questionnaire-access/${shareToken}`);
        if (!cancelled) setShell(response.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load questionnaire response link.');
          setLoginRequiredError(isQuestionnaireLoginRequired(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadShell();
    return () => { cancelled = true; requestGeneration.current += 1; };
  }, [shareToken]);

  function updateAnswer(ref: string, value: unknown) {
    setNotice(null);
    setAnswers((current) => ({ ...current, [ref]: value }));
  }

  function updateUpload(ref: string, value: string) {
    setNotice(null);
    setUploads((current) => ({ ...current, [ref]: value }));
  }

  async function validateAccessCode() {
    if (!shareToken) return;
    const generation = requestGeneration.current;
    try {
      setSaving(true);
      setError(null);
      setLoginRequiredError(false);
      setNotice(null);
      const response = await client.post<{ data: QuestionnaireInstance }>(`/builders/questionnaire-access/${shareToken}/validate`, { accessCode });
      if (generation !== requestGeneration.current) return;
      setInstance(response.data);
      setAnswers(response.data.answers ?? {});
      setUploads(response.data.uploads ?? {});
      setNotice('Access code accepted. You can now complete the questionnaire.');
    } catch (err) {
      if (generation === requestGeneration.current) {
        setError(err instanceof Error ? err.message : 'Unable to validate access code.');
        setLoginRequiredError(isQuestionnaireLoginRequired(err));
      }
    } finally {
      if (generation === requestGeneration.current) setSaving(false);
    }
  }

  async function saveResponses(submit = false) {
    if (!shareToken) return;
    const generation = requestGeneration.current;
    try {
      setSaving(true);
      setError(null);
      setLoginRequiredError(false);
      setNotice(null);
      const response = await client.put<{ data: QuestionnaireInstance }>(`/builders/questionnaire-access/${shareToken}/responses`, {
        accessCode,
        answers,
        uploads,
      });
      if (generation !== requestGeneration.current) return;
      setInstance(response.data);
      setAnswers(response.data.answers ?? {});
      setUploads(response.data.uploads ?? {});
      if (submit) {
        const submitted = await client.post<{ data: QuestionnaireInstance }>(`/builders/questionnaire-access/${shareToken}/submit`, { accessCode });
        if (generation !== requestGeneration.current) return;
        setInstance(submitted.data);
        setAnswers(submitted.data.answers ?? {});
        setUploads(submitted.data.uploads ?? {});
        setNotice('Questionnaire submitted. Answers are now locked for review.');
        setPendingSubmitReview(false);
      } else {
        setNotice('Progress saved.');
      }
    } catch (err) {
      if (generation === requestGeneration.current) {
        setError(err instanceof Error ? err.message : 'Unable to save questionnaire response.');
        setLoginRequiredError(isQuestionnaireLoginRequired(err));
      }
    } finally {
      if (generation === requestGeneration.current) setSaving(false);
    }
  }

  const signInLink = shareToken ? `/login?next=${encodeURIComponent(`/questionnaires/response/${encodeURIComponent(shareToken)}`)}` : '/login';

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#fbf9fc] px-4 py-8 text-[#241232] sm:px-6 lg:px-8">
        <div className="panel mx-auto max-w-5xl p-6 text-sm text-[#4f435c]">Loading questionnaire response...</div>
      </div>
    );
  }

  if (!shell) {
    return (
      <div className="min-h-dvh bg-[#fbf9fc] px-4 py-8 text-[#241232] sm:px-6 lg:px-8">
        <div className="notice-error mx-auto max-w-5xl">
          {error ?? 'Questionnaire response link was not found.'}
          {loginRequiredError ? <p className="mt-3"><a className="button-secondary" href={signInLink}>Sign in</a></p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#fbf9fc] px-4 py-8 text-[#241232] sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="panel">
        <div className="eyebrow">Questionnaire Response</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">{shell.title}</h1>
        <p className="mt-3 text-sm text-[#4f435c]">
          {shell.templateName} · {instance?.status ?? shell.status} · Due {shell.dueDate ?? 'not set'}
        </p>
      </section>

      {notice ? <div aria-live="polite" className="notice-success" role="status">{notice}</div> : null}
      {error ? <div className="notice-error">{error}{loginRequiredError ? <p className="mt-3"><a className="button-secondary" href={signInLink}>Sign in</a></p> : null}</div> : null}

      {!instance ? (
        <section className="panel max-w-xl">
          <div className="eyebrow">Access Code Login</div>
          <p className="mt-3 text-sm leading-6 text-[#4f435c]">
            Enter the access code from your questionnaire email to open this response without a Regovise user account.
          </p>
          <label className="mt-4 block text-sm font-semibold text-[#241232]" htmlFor="questionnaire-access-code">
            Access code
          </label>
          <input
            autoComplete="one-time-code"
            className="input mt-2"
            disabled={saving}
            id="questionnaire-access-code"
            inputMode="numeric"
            onChange={(event) => { setNotice(null); setAccessCode(event.target.value); }}
            placeholder="9-digit access code"
            value={accessCode}
          />
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
            <RegStatusPill>{instance.status}</RegStatusPill>
            <RegStatusPill>{Math.round(instance.percentComplete)}% complete</RegStatusPill>
            <RegStatusPill tone={passingTone(instance.passingStatus)}>{instance.passingStatus}</RegStatusPill>
            {runtime?.displayOptions?.displayscore ? <RegStatusPill>Score {instance.score}/{instance.maxScore}</RegStatusPill> : null}
            {runtime?.displayOptions?.displaygrade ? <RegStatusPill>Grade {instance.grade ?? 'Pending'}</RegStatusPill> : null}
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
              const locked = saving || !['Open', 'RequestChanges'].includes(instance.status) || disabledQuestions.has(question.ref);
              const required = requiredQuestions.has(question.ref);
              const fieldId = `question-${question.ref}`;
              const labelId = `${fieldId}-label`;
              const uploadFieldId = `question-${question.ref}-evidence`;
              const answer = answers[question.ref];
              const table = question.type === 'table' ? editableTable(question.tableColumns, answer) : null;
              const multiSelectValue = Array.isArray(answer) && answer.every((value) => typeof value === 'string') ? answer as string[] : null;
              const invalidMultiSelect = question.type === 'multi-select' && answer !== undefined && !multiSelectValue;
              const structuredAnswer = !['multi-select', 'table'].includes(question.type) && answer !== null && typeof answer === 'object';
              const readOnly = (question.type === 'table' && !table) || invalidMultiSelect || structuredAnswer;
              const upload = uploads[question.ref];
              const structuredUpload = upload !== null && typeof upload === 'object';
              return (
              <div className={`rounded-lg border border-[#ded8e4] bg-white p-4 shadow-[0_8px_24px_rgba(48,24,72,0.04)]${question.type === 'table' ? ' md:col-span-2' : ''}`} key={question.ref}>
                <label className="block font-medium text-[#241232]" htmlFor={readOnly || ['instructional', 'table'].includes(question.type) ? undefined : fieldId} id={labelId}>
                  {question.prompt}
                  {required ? <span className="ml-1 text-[#9d1f2c]">*</span> : null}
                </label>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#62576a]">{question.section}</div>
                {question.helpText ? <p className="mt-3 text-sm text-[#6f6578]">{question.helpText}</p> : null}
                <div className="mt-4">
                  {question.type === 'instructional' ? (
                    <div className="rounded-lg border border-[#d7c3f1] bg-[#f6f1fa] p-3 text-sm text-[#4f435c]">{question.evidenceHint ?? question.prompt}</div>
                  ) : readOnly ? renderStoredResponse(answer, fieldId, labelId,
                    question.type === 'table'
                      ? 'Table responses are read-only in this link. Contact the sender to update this response.'
                      : invalidMultiSelect
                        ? 'This stored response is not a list of text selections and is read-only in this link. Contact the sender to update this response.'
                        : 'This stored response uses a structured format and is read-only in this link. Contact the sender to update this response.',
                    invalidMultiSelect
                  ) : table ? (
                    <QuestionnaireTableEditor {...table} fieldId={fieldId} labelId={labelId} locked={locked} onChange={(rows) => updateAnswer(question.ref, rows)} prompt={question.prompt} />
                  ) : question.type === 'boolean' ? (
                    <select className="input" disabled={locked} id={fieldId} value={String(answer ?? false)} onChange={(event) => updateAnswer(question.ref, event.target.value === 'true')}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : question.type === 'multi-select' ? (
                    <select
                      className="input"
                      disabled={locked}
                      id={fieldId}
                      multiple
                      onChange={(event) => updateAnswer(question.ref, Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
                      value={multiSelectValue ?? []}
                    >
                      {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      {Array.from(new Set(multiSelectValue ?? [])).filter((option) => !(question.options ?? []).includes(option)).map((option) => (
                        <option key={option} value={option}>{option} (stored selection)</option>
                      ))}
                    </select>
                  ) : question.type === 'single-select' ? (
                    <select className="input" disabled={locked} id={fieldId} value={String(answer ?? '')} onChange={(event) => updateAnswer(question.ref, event.target.value)}>
                      <option value="">Select an option</option>
                      {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <textarea className="input min-h-[88px]" disabled={locked} id={fieldId} value={String(answer ?? '')} onChange={(event) => updateAnswer(question.ref, event.target.value)} />
                  )}
                </div>
                {(question.enableUpload || question.type === 'file-upload') && (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-[#241232]" htmlFor={structuredUpload ? undefined : uploadFieldId} id={`${uploadFieldId}-label`}>
                      Evidence reference
                    </label>
                    {structuredUpload ? renderStoredResponse(upload, uploadFieldId, `${uploadFieldId}-label`,
                      'This stored evidence reference uses a structured format and is read-only in this link. Contact the sender to update it.'
                    ) : <textarea
                      className="input mt-2 min-h-[72px]"
                      disabled={locked}
                      id={uploadFieldId}
                      onChange={(event) => updateUpload(question.ref, event.target.value)}
                      placeholder="Evidence file name, URL, or artifact reference"
                      value={String(upload ?? '')}
                    />}
                  </>
                )}
              </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={saving || !['Open', 'RequestChanges'].includes(instance.status)} onClick={() => void saveResponses(false)} type="button">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="button-primary" disabled={saving || !['Open', 'RequestChanges'].includes(instance.status)} onClick={() => setPendingSubmitReview(true)} type="button">
              Submit
            </button>
          </div>
              </>
            );
          })()}
        </section>
      )}
      <RegModal
        open={pendingSubmitReview}
        onOpenChange={setPendingSubmitReview}
        title="Submit questionnaire response"
        description="Review this response before locking the answers for reviewer analysis."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" disabled={saving} onClick={() => setPendingSubmitReview(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={saving || !instance} onClick={() => void saveResponses(true)} type="button">
              {saving ? 'Submitting...' : 'Submit response'}
            </button>
          </div>
        }
      >
        {instance ? (
          <div className="space-y-4 text-sm leading-6 text-[#4f435c]">
            <p>
              Submitting saves the latest draft and moves this response into review. Respondents cannot keep editing
              unless a reviewer requests changes.
            </p>
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{shell.title}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <RegStatusPill>{instance.status}</RegStatusPill>
                <RegStatusPill>{Math.round(instance.percentComplete)}% complete</RegStatusPill>
                <RegStatusPill tone={passingTone(instance.passingStatus)}>
                  {instance.passingStatus}
                </RegStatusPill>
                <RegStatusPill>{shell.questions.length} questions</RegStatusPill>
              </div>
            </div>
          </div>
        ) : null}
      </RegModal>
    </div>
    </div>
  );
}
