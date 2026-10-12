import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { RegStatusPill } from '../../components/regovise/PagePrimitives';
import type { AssuranceExplainAudience, AssuranceExplanation } from './types';

type AudienceOption = {
  value: AssuranceExplainAudience;
  label: string;
};

type FocusOption = {
  value: string;
  label: string;
};

type AssuranceExplainPanelProps = {
  heading: string;
  helperText: string;
  requestKey: string;
  disabled?: boolean;
  defaultAudience: AssuranceExplainAudience;
  initialAudience?: AssuranceExplainAudience;
  initialFocusId?: string;
  initialQuestion?: string;
  audiences: AudienceOption[];
  focusOptions?: FocusOption[];
  onAudienceChange?: (audience: AssuranceExplainAudience) => void;
  onFocusIdChange?: (focusId: string) => void;
  loadExplanation: (args: {
    audience: AssuranceExplainAudience;
    focusId?: string;
    question?: string;
  }) => Promise<AssuranceExplanation>;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export function AssuranceExplainPanel({
  heading,
  helperText,
  requestKey,
  disabled = false,
  defaultAudience,
  initialAudience,
  initialFocusId = '',
  initialQuestion = '',
  audiences,
  focusOptions = [],
  onAudienceChange,
  onFocusIdChange,
  loadExplanation,
}: AssuranceExplainPanelProps) {
  const effectiveInitialAudience = initialAudience ?? defaultAudience;
  const [audience, setAudience] = useState<AssuranceExplainAudience>(effectiveInitialAudience);
  const [focusId, setFocusId] = useState(initialFocusId);
  const [question, setQuestion] = useState(initialQuestion);
  const [explanation, setExplanation] = useState<AssuranceExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateExplanation(nextAudience = audience) {
    try {
      setLoading(true);
      setError(null);
      const data = await loadExplanation({
        audience: nextAudience,
        focusId: focusId || undefined,
        question: question.trim() || undefined,
      });
      setExplanation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate the assurance explanation.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAudience(effectiveInitialAudience);
    setFocusId(initialFocusId);
    setQuestion(initialQuestion);
    setExplanation(null);
    setError(null);
  }, [effectiveInitialAudience, initialFocusId, initialQuestion, requestKey]);

  useEffect(() => {
    if (!requestKey || disabled) {
      return;
    }
    void generateExplanation(effectiveInitialAudience);
  }, [disabled, effectiveInitialAudience, initialFocusId, requestKey]);

  return (
    <section className="panel-subtle">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="label">{heading}</div>
          <p className="mt-2 text-sm leading-6 text-[#6f6578]">{helperText}</p>
        </div>
        <button
          className="button-secondary"
          disabled={disabled || loading}
          onClick={() => void generateExplanation()}
          type="button"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[0.52fr_1.48fr]">
        <div className="space-y-3">
          <label className="space-y-1">
            <span className="label">Audience</span>
            <select
              className="input"
              onChange={(event) => {
                const nextAudience = event.target.value as AssuranceExplainAudience;
                setAudience(nextAudience);
                onAudienceChange?.(nextAudience);
              }}
              value={audience}
            >
              {audiences.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {focusOptions.length > 0 && (
            <label className="space-y-1">
              <span className="label">Focus</span>
              <select
                className="input"
                onChange={(event) => {
                  setFocusId(event.target.value);
                  onFocusIdChange?.(event.target.value);
                }}
                value={focusId}
              >
                <option value="">Whole run</option>
                {focusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-1">
            <span className="label">Question</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Optional: ask for a tighter explanation of a gap, control mapping, or review decision."
              value={question}
            />
          </label>

          <button className="button-primary w-full" disabled={disabled || loading} onClick={() => void generateExplanation()} type="button">
            {loading ? 'Generating...' : 'Generate explanation'}
          </button>
        </div>

        <div className="rounded-3xl border border-[#ded8e4] bg-white p-4">
          {error && <div className="notice-error">{error}</div>}

          {!error && !explanation && !loading && (
            <div className="text-sm text-[#6f6578]">Select an assurance item to load the explainer.</div>
          )}

          {loading && !explanation && <div className="text-sm text-[#6f6578]">Generating the current explanation...</div>}

          {explanation && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <RegStatusPill tone="neutral">{explanation.audience}</RegStatusPill>
                <RegStatusPill tone={explanation.provider === 'cloudflare-workers-ai' ? 'success' : 'neutral'}>
                  {explanation.provider === 'cloudflare-workers-ai' ? 'AI-backed' : 'Deterministic'}
                </RegStatusPill>
                <span className="text-xs text-[#62576a]">{formatDate(explanation.generatedAt)}</span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#241232]">{explanation.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4f435c]">{explanation.explanation}</p>
              </div>

              {explanation.highlights.length > 0 && (
                <div>
                  <div className="label">Highlights</div>
                  <div className="mt-2 space-y-2">
                    {explanation.highlights.map((item) => (
                      <div key={item} className="rounded-2xl border border-[#ded8e4] bg-[#f7f4f9] px-3 py-2 text-sm text-[#4f435c]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanation.suggestedActions.length > 0 && (
                <div>
                  <div className="label">Suggested actions</div>
                  <div className="mt-2 space-y-2">
                    {explanation.suggestedActions.map((item) => (
                      <div key={item} className="rounded-2xl border border-[#d7c3f1] bg-[#f7f2ff] px-3 py-2 text-sm text-[#4f236e]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanation.evidenceRefs.length > 0 && (
                <div>
                  <div className="label">Evidence refs</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {explanation.evidenceRefs.map((item) => (
                      <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f4f9] px-3 py-1 font-mono text-xs text-[#6f20c9]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
