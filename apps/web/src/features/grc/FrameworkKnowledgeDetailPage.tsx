import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';
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
    return <section className="panel p-6 text-sm text-[#4f435c]">Loading catalogue knowledge...</section>;
  }

  if (!detail) {
    return <section className="panel p-6 text-sm text-[#4f435c]">Framework content is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance / Catalogue Knowledge"
        title={detail.name}
        description={detail.description || 'Imported reference content for this catalogue is available below.'}
        actions={
          <Link className="button-secondary" to="/framework-library">
            Back to Catalogue Library
          </Link>
        }
        meta={
          <>
            <RegStatusPill tone={detail.crosswalkReady ? 'success' : 'neutral'}>
              {detail.crosswalkReady ? 'SCF synchronized' : 'Content synchronized'}
            </RegStatusPill>
            {detail.version ? <RegStatusPill tone="neutral">v{detail.version}</RegStatusPill> : null}
            <RegStatusPill tone="purple">{detail.frameworkKey}</RegStatusPill>
            <RegStatusPill tone="info">{detail.documents.length} documents</RegStatusPill>
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />

      <section className="panel">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Catalogue key</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{detail.frameworkKey}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">SCF framework</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{detail.scfFrameworkId ?? 'Not mapped'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Documents</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.documents.length}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Updated</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{formatTimestamp(detail.updatedAt)}</div>
          </div>
        </div>

        {detail.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.tags.map((tag) => (
              <RegStatusPill tone="neutral" key={tag}>
                {tag}
              </RegStatusPill>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="panel min-w-0 space-y-3">
          <div className="eyebrow">Imported catalogue documents</div>
          {detail.documents.map((item) => {
            const active = item.slug === selectedSlug;
            return (
              <button
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-[#d7c3f1] bg-[#f2e8ff] text-[#241232]'
                    : 'border-[#ded8e4] bg-[#fbf9fc] text-[#4f435c] hover:border-[#d7c3f1] hover:bg-[#f6f1fa]'
                }`}
                key={item.id}
                onClick={() => setSelectedSlug(item.slug)}
                type="button"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#62576a]">
                  {DOC_KIND_LABELS[item.docKind] ?? item.docKind}
                </div>
                <div className="mt-2 text-base font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-[#6f6578]">
                  {item.summary || 'Managed reference content imported into Regovise.'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="panel min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">{selectedMeta ? DOC_KIND_LABELS[selectedMeta.docKind] ?? selectedMeta.docKind : 'Document'}</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{document?.title ?? selectedMeta?.title ?? 'Select a document'}</h2>
              </div>
              {selectedMeta ? (
                <div className="text-right text-xs text-[#6f6578]">
                  <div>Source: {selectedMeta.sourcePath}</div>
                  <div className="mt-1">Imported: {formatTimestamp(selectedMeta.importedAt)}</div>
                </div>
              ) : null}
            </div>

            {document ? (
              <article className="mt-6 min-w-0 rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 text-sm leading-7 text-[#38254a]">
                <div className="min-w-0 whitespace-pre-wrap break-words">{document.bodyMarkdown}</div>
              </article>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
                Select a catalogue document to view the imported guidance.
              </div>
            )}
          </div>

          <div className="panel min-w-0">
            <div className="eyebrow">Catalogue tutoring</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Crosswalk & control guidance</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Resolve a catalogue-native control into SCF mappings and downstream target obligations
              so operators can see how one implementation change closes work across multiple
              governing frameworks.
            </p>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none transition focus:border-[#8b35e6]"
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
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5">
                  <div className="eyebrow">SCF controls</div>
                  <div className="mt-4 space-y-3">
                    {controlMap.scfControls.map((item) => (
                      <div className="min-w-0 rounded-3xl border border-[#ded8e4] bg-white p-4" key={item.controlId}>
                        <div className="text-sm font-semibold text-[#241232]">{item.controlId}</div>
                        <div className="mt-2 text-sm text-[#4f435c]">{item.title}</div>
                        <div className="mt-2 text-xs text-[#62576a]">
                          {item.familyCode ?? 'Family'} {item.familyName ? `• ${item.familyName}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5">
                  <div className="eyebrow">Target obligations</div>
                  <div className="mt-4 space-y-3">
                    {controlMap.targets.map((target) => (
                      <div className="min-w-0 rounded-3xl border border-[#ded8e4] bg-white p-4" key={target.frameworkId}>
                        <div className="text-sm font-semibold text-[#241232]">{target.frameworkName}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {target.controlIds.map((targetControlId) => (
                            <RegStatusPill tone="neutral" key={targetControlId}>
                              {targetControlId}
                            </RegStatusPill>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-3xl border border-[#ded8e4] bg-white p-4 text-sm text-[#4f435c]">
                    Matching normalized findings: {controlMap.findingMatchCount ?? 0}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
                Resolve a control to inspect its SCF mapping and downstream target coverage.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
