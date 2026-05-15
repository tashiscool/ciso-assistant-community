import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getControlMap, getFrameworkDetail, getFrameworkDocument } from './api';
import type { CrosswalkResolution, FrameworkContentDocument, FrameworkKnowledgeDetail } from './types';

const DOC_KIND_LABELS: Record<string, string> = {
  overview: 'Overview',
  'assessment-guide': 'Assessment Guide',
  'evidence-checklist': 'Evidence Checklist',
  'implementation-guidance': 'Implementation Guidance',
  'workflow-playbook': 'Workflow Playbook',
  'workflow-guidance': 'Workflow Guidance',
};

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

export function FrameworkKnowledgeDetailPage() {
  const { frameworkId = '' } = useParams();
  const [detail, setDetail] = useState<FrameworkKnowledgeDetail | null>(null);
  const [document, setDocument] = useState<FrameworkContentDocument | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [controlId, setControlId] = useState('');
  const [controlMap, setControlMap] = useState<CrosswalkResolution | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await getFrameworkDetail(frameworkId);
        if (cancelled) {
          return;
        }
        setDetail(response);
        setSelectedSlug((current) => current ?? response.documents[0]?.slug ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load framework detail.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [frameworkId]);

  useEffect(() => {
    if (!selectedSlug) {
      setDocument(null);
      return;
    }
    const documentSlug = selectedSlug;

    let cancelled = false;

    async function loadDocument() {
      try {
        setError(null);
        const response = await getFrameworkDocument(frameworkId, documentSlug);
        if (!cancelled) {
          setDocument(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load framework content.');
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [frameworkId, selectedSlug]);

  const selectedMeta = useMemo(
    () => detail?.documents.find((item) => item.slug === selectedSlug) ?? null,
    [detail, selectedSlug],
  );

  async function handleResolveControl() {
    if (!controlId.trim()) {
      return;
    }
    try {
      setMappingLoading(true);
      setError(null);
      const response = await getControlMap(frameworkId, controlId.trim());
      setControlMap(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resolve the selected control.');
    } finally {
      setMappingLoading(false);
    }
  }

  if (loading) {
    return <section className="panel p-6 text-sm text-slate-300">Loading framework knowledge...</section>;
  }

  if (!detail) {
    return <section className="panel p-6 text-sm text-slate-300">Framework content is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-300 transition hover:text-cyan-200" to="/framework-library">
          ← Back to Framework Library
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Framework Knowledge</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{detail.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {detail.description || 'Imported reference content for this framework is available below.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={detail.crosswalkReady ? 'badge-success' : 'badge-neutral'}>
              {detail.crosswalkReady ? 'SCF synchronized' : 'Content synchronized'}
            </span>
            {detail.version ? <span className="badge-neutral">v{detail.version}</span> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Framework key</div>
            <div className="mt-2 text-sm font-semibold text-white">{detail.frameworkKey}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">SCF framework</div>
            <div className="mt-2 text-sm font-semibold text-white">{detail.scfFrameworkId ?? 'Not mapped'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Documents</div>
            <div className="mt-2 text-2xl font-semibold text-white">{detail.documents.length}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Updated</div>
            <div className="mt-2 text-sm font-semibold text-white">{formatTimestamp(detail.updatedAt)}</div>
          </div>
        </div>

        {detail.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.tags.map((tag) => (
              <span className="badge-neutral" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="panel space-y-3">
          <div className="eyebrow">Imported documents</div>
          {detail.documents.map((item) => {
            const active = item.slug === selectedSlug;
            return (
              <button
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-cyan-300/30 bg-cyan-400/[0.06] text-white'
                    : 'border-white/10 bg-slate-950/20 text-slate-300 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                }`}
                key={item.id}
                onClick={() => setSelectedSlug(item.slug)}
                type="button"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {DOC_KIND_LABELS[item.docKind] ?? item.docKind}
                </div>
                <div className="mt-2 text-base font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  {item.summary || 'Managed reference content imported into Regovise.'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">{selectedMeta ? DOC_KIND_LABELS[selectedMeta.docKind] ?? selectedMeta.docKind : 'Document'}</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{document?.title ?? selectedMeta?.title ?? 'Select a document'}</h2>
              </div>
              {selectedMeta ? (
                <div className="text-right text-xs text-slate-400">
                  <div>Source: {selectedMeta.sourcePath}</div>
                  <div className="mt-1">Imported: {formatTimestamp(selectedMeta.importedAt)}</div>
                </div>
              ) : null}
            </div>

            {document ? (
              <article className="mt-6 rounded-3xl border border-white/10 bg-slate-950/30 p-5 text-sm leading-7 text-slate-200">
                <div className="whitespace-pre-wrap">{document.bodyMarkdown}</div>
              </article>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                Select a framework document to view the imported guidance.
              </div>
            )}
          </div>

          <div className="panel">
            <div className="eyebrow">Framework tutoring</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Crosswalk & control guidance</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Resolve a framework-native control into SCF mappings and downstream target obligations so operators can
              see how one implementation change closes work across multiple frameworks.
            </p>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setControlId(event.target.value)}
                placeholder="Enter a control reference such as CC6.1 or AC-2"
                value={controlId}
              />
              <button className="button-secondary" disabled={mappingLoading} onClick={() => void handleResolveControl()} type="button">
                {mappingLoading ? 'Resolving…' : 'Resolve control'}
              </button>
            </div>

            {controlMap ? (
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="eyebrow">SCF controls</div>
                  <div className="mt-4 space-y-3">
                    {controlMap.scfControls.map((item) => (
                      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4" key={item.controlId}>
                        <div className="text-sm font-semibold text-white">{item.controlId}</div>
                        <div className="mt-2 text-sm text-slate-300">{item.title}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {item.familyCode ?? 'Family'} {item.familyName ? `• ${item.familyName}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="eyebrow">Target obligations</div>
                  <div className="mt-4 space-y-3">
                    {controlMap.targets.map((target) => (
                      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4" key={target.frameworkId}>
                        <div className="text-sm font-semibold text-white">{target.frameworkName}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {target.controlIds.map((targetControlId) => (
                            <span className="badge-neutral" key={targetControlId}>
                              {targetControlId}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                    Matching normalized findings: {controlMap.findingMatchCount ?? 0}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                Resolve a control to inspect its SCF mapping and downstream target coverage.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
