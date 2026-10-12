import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RegPageHeader, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { createGapAssessment, getFrameworkLibrary, getGapAssessments } from './api';
import type { FrameworkLibrarySummary, GapAssessmentSummary } from './types';

export function GapAssessmentsPage() {
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState<FrameworkLibrarySummary[]>([]);
  const [assessments, setAssessments] = useState<GapAssessmentSummary[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [sources, setSources] = useState('');
  const [severities, setSeverities] = useState('critical,high,medium');
  const [statuses, setStatuses] = useState('fail,inconclusive');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [frameworkData, assessmentData] = await Promise.all([getFrameworkLibrary(), getGapAssessments()]);
      setFrameworks(frameworkData);
      setAssessments(assessmentData);
      setSelectedFrameworks((current) => (current.length > 0 ? current : frameworkData.slice(0, 2).map((item) => item.slug)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load gap assessment workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);
      const detail = await createGapAssessment({
        title: title.trim() || undefined,
        frameworks: selectedFrameworks,
        sources: sources
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        severities: severities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        statuses: statuses
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      navigate(`/gap-assessments/${detail.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the gap assessment.');
    } finally {
      setCreating(false);
    }
  }

  function toggleFramework(slug: string) {
    setSelectedFrameworks((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance / Cross-Framework Analysis"
        title="Gap Assessment Workspace"
        description="Combine imported findings, SCF-backed control expansions, and curated framework guidance into reusable assessment runs that can be promoted into report bundles."
        meta={
          <>
            <RegStatusPill tone="neutral">{assessments.length} runs</RegStatusPill>
            <RegStatusPill tone="purple">{selectedFrameworks.length} selected frameworks</RegStatusPill>
            <RegStatusPill tone="info">{frameworks.length} available frameworks</RegStatusPill>
          </>
        }
        actions={
          <>
            <button className="button-secondary" onClick={() => void load()} type="button">
              Refresh
            </button>
            <button className="button-primary" onClick={() => setCreateDrawerOpen(true)} type="button">
              Run gap assessment
            </button>
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />

      {error ? <div className="notice-error">{error}</div> : null}

      <section>
        <div className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Assessment history</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Recent runs</h2>
            </div>
            <RegStatusPill tone="neutral">{assessments.length} runs</RegStatusPill>
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
              Loading assessments...
            </div>
          ) : null}

          {!loading && assessments.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
              No gap assessments have been created yet.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            {assessments.map((assessment) => (
              <Link
                className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
                key={assessment.id}
                to={`/gap-assessments/${assessment.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{assessment.frameworks.join(' · ')}</div>
                    <h3 className="mt-2 text-xl font-semibold text-[#241232]">{assessment.title}</h3>
                  </div>
                  <RegStatusPill tone="info">{assessment.status}</RegStatusPill>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="panel-subtle">
                    <div className="label">Sources</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{assessment.sources.length}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Findings</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{assessment.findingsCount}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Gaps</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{assessment.gapCount}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Updated</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">
                      {new Date(assessment.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <RegRightDrawer
        description="Create a reusable assessment run from selected framework targets, sources, severities, and finding statuses."
        footer={
          <>
            <button className="button-secondary" onClick={() => setCreateDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={creating || selectedFrameworks.length === 0}
              form="gap-assessment-create-form"
              type="submit"
            >
              {creating ? 'Running assessment...' : 'Run assessment'}
            </button>
          </>
        }
        onOpenChange={setCreateDrawerOpen}
        open={createDrawerOpen}
        title="Run gap assessment"
      >
        <form
          className="space-y-5"
          id="gap-assessment-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <label className="block text-sm font-semibold text-[#241232]">
            Title
            <input
              className="input mt-2 w-full"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="SOC 2 + FedRAMP readiness"
              value={title}
            />
          </label>

          <div>
            <div className="mb-2 text-sm font-semibold text-[#241232]">Framework targets</div>
            <div className="grid gap-3">
              {frameworks.map((framework) => (
                <label className="flex items-start gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4" key={framework.id}>
                  <input
                    checked={selectedFrameworks.includes(framework.slug)}
                    className="mt-1"
                    onChange={() => toggleFramework(framework.slug)}
                    type="checkbox"
                  />
                  <div>
                    <div className="text-sm font-semibold text-[#241232]">{framework.name}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">{framework.frameworkKey}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="block text-sm font-semibold text-[#241232]">
            Sources
            <input
              className="input mt-2 w-full"
              onChange={(event) => setSources(event.target.value)}
              placeholder="github, wiz, aws-inspector"
              value={sources}
            />
          </label>

          <label className="block text-sm font-semibold text-[#241232]">
            Included severities
            <input className="input mt-2 w-full" onChange={(event) => setSeverities(event.target.value)} value={severities} />
          </label>

          <label className="block text-sm font-semibold text-[#241232]">
            Included statuses
            <input className="input mt-2 w-full" onChange={(event) => setStatuses(event.target.value)} value={statuses} />
          </label>
        </form>
      </RegRightDrawer>
    </div>
  );
}
