import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Image as ImageIcon, ListTree, Sparkles } from 'lucide-react';
import { listExportBuilderConfigs } from './exportApi';
import type { StarterTemplate } from './exportTypes';

type GuideExample = {
  id: string;
  label: string;
  summary: string;
  placeholders: string[];
  preview: string[];
  lint: string[];
};

const guideExamples: GuideExample[] = [
  {
    id: 'static-table',
    label: 'Static table example',
    summary: 'Good for cover sheets and simple metadata blocks with one value per row.',
    placeholders: ['{{systemname}}', '{{authorizationDate}}', '{{authorization-boundaryfilename}}'],
    preview: ['System Name: {{systemname}}', 'Authorization Date: {{authorizationDate}}', 'Boundary File: {{authorization-boundaryfilename}}'],
    lint: ['Tag names are concise and auto-map friendly.', 'Formatting around each placeholder is preserved in Word.'],
  },
  {
    id: 'repeating-table',
    label: 'Repeating table example',
    summary: 'Use repeating rows for child records like controls, evidence, or assets.',
    placeholders: ['{{control_id}}', '{{control_title}}', '{{implementation_statement}}'],
    preview: ['| {{control_id}} | {{control_title}} | {{implementation_statement}} |'],
    lint: ['Keep child-record placeholders inside the repeated row region.', 'Mixed parent and child placeholders should be separated cleanly.'],
  },
  {
    id: 'checkbox',
    label: 'Yes/No checkbox example',
    summary: 'Reserved checkbox patterns produce reliable yes/no rendering in generated documents.',
    placeholders: ['{{checkbox}}', '{{checkboxYESNO}}', '{{chkboxYN-01}}'],
    preview: ['Compliant: {{checkboxYESNO}}', 'Approved: {{chkboxYN-01}}'],
    lint: ['Dedicated checkbox placeholders are easier to render than free-form boolean text.', 'Avoid mixing checkbox styles in the same template section.'],
  },
];

function lintPlaceholders(placeholders: string[]) {
  const notes: string[] = [];
  for (const placeholder of placeholders) {
    if (!/^{{[^{}]+}}$/.test(placeholder)) {
      notes.push(`${placeholder} is malformed and should use double curly braces.`);
    }
    if (placeholder.includes(' ')) {
      notes.push(`${placeholder} contains spaces and may reduce auto-map confidence.`);
    }
  }
  if (new Set(placeholders).size !== placeholders.length) {
    notes.push('Duplicate placeholders detected; confirm repeated-table intent.');
  }
  if (notes.length === 0) {
    notes.push('Template placeholders pass guide-level lint checks.');
  }
  return notes;
}

export function ExportBuilderDocxGuidePage() {
  const [starterTemplates, setStarterTemplates] = useState<StarterTemplate[]>([]);
  const [selectedExampleId, setSelectedExampleId] = useState(guideExamples[0].id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await listExportBuilderConfigs();
        setStarterTemplates(response.starterTemplates.filter((template) => template.exportType === 'DOCX'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load DOCX guide resources.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const selectedExample = useMemo(
    () => guideExamples.find((example) => example.id === selectedExampleId) ?? guideExamples[0],
    [selectedExampleId],
  );

  const lintNotes = useMemo(
    () => [...selectedExample.lint, ...lintPlaceholders(selectedExample.placeholders)],
    [selectedExample],
  );

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Creating an Export Builder DOCX Template</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Help administrators and content authors design DOCX templates that use <code>{'{{field_name}}'}</code>{' '}
              placeholder tags for Regovise exports, preserve Word formatting, and stay friendly to auto-mapping and preview validation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/builders/export-builder">
              <FileText className="mr-2 h-4 w-4" />
              Open Export Builder
            </Link>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">DOCX Starters</div>
          <div className="metric-value">{loading ? '…' : starterTemplates.length}</div>
          <div className="mt-2 text-xs text-slate-500">System templates available for copy-and-customize.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Placeholder Syntax</div>
          <div className="metric-value">{'{{ }}'}</div>
          <div className="mt-2 text-xs text-slate-500">Use double curly braces for every field token.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Best Practice</div>
          <div className="metric-value">Preview + lint</div>
          <div className="mt-2 text-xs text-slate-500">Validate before activation inside Export Builder.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Image Support</div>
          <div className="metric-value">Textbox</div>
          <div className="mt-2 text-xs text-slate-500">Place images in Word textboxes for better scaling behavior.</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <div className="panel-subtle">
            <div className="eyebrow">Authoring Rules</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                <div>Use <code>{'{{double_curly_braces}}'}</code> for every placeholder tag.</div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
                <div>Tag names should mirror field names where possible so auto-mapping scores stay high.</div>
              </div>
              <div className="flex items-start gap-3">
                <ImageIcon className="mt-0.5 h-4 w-4 text-cyan-300" />
                <div>Place image placeholders inside Word textboxes for more predictable export rendering.</div>
              </div>
              <div className="flex items-start gap-3">
                <ListTree className="mt-0.5 h-4 w-4 text-cyan-300" />
                <div>Keep repeating child-record placeholders inside a consistent repeated row or block.</div>
              </div>
            </div>
          </div>

          <div className="panel-subtle">
            <div className="eyebrow">Placeholder Reference</div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Example</th>
                    <th className="pb-3 font-medium">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-300">
                  {[
                    ['Text', '{{systemname}}', 'Direct system metadata and headings'],
                    ['Date (MM/DD/YYYY)', '{{authorizationDate}}', 'UTC date output for approvals and cover sheets'],
                    ['Date (YYYY-MM-DD)', '{{authorizationDateYYYYMMDD}}', 'ISO-style date output for worksheets and machine-readable packages'],
                    ['Checkbox', '{{checkbox}}', 'Boolean field rendered as a checked or unchecked box'],
                    ['Checkbox', '{{checkboxYESNO}}', 'Yes/No checkbox rendering'],
                    ['File Name', '{{authorization-boundaryfilename}}', 'File labels and appendix references'],
                    ['Image', '{{authorization-boundaryimage}}', 'Rendered inside Word textboxes'],
                  ].map((row) => (
                    <tr key={row[1]}>
                      <td className="py-3 pr-4">{row[0]}</td>
                      <td className="py-3 pr-4">
                        <code>{row[1]}</code>
                      </td>
                      <td className="py-3">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-subtle">
            <div className="eyebrow">Tables, Lists, And Checkbox Patterns</div>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div>
                <div className="font-medium text-white">Static table</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono">
                  Security Plan ID: {'{{securityplanid}}'} · System Name: {'{{systemname}}'} · Categorization: {'{{categorization}}'}
                </div>
              </div>
              <div>
                <div className="font-medium text-white">Repeating table row</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono">
                  {'{{issueid}}'} | {'{{title}}'} | {'{{severity}}'} | {'{{issueowner}}'}
                </div>
              </div>
              <div>
                <div className="font-medium text-white">Bullet list</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono">
                  • {'{{levauthtitle}}'}
                </div>
              </div>
              <div>
                <div className="font-medium text-white">Standard and Yes/No checkboxes</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono">
                  {'{{chkbox-01}}'} Authorization · {'{{chkbox-02}}'} Capture · {'{{chkboxYN-01}}'} Yes/No
                </div>
              </div>
            </div>
          </div>

          <div className="panel-subtle">
            <div className="eyebrow">Starter DOCX Templates</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {starterTemplates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="font-medium text-white">{template.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {template.module} · {template.defaultFileName}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge-neutral">{template.exportGroup}</span>
                    <span className="badge-neutral">{template.defaultTags.length} starter tags</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel-subtle">
            <div className="eyebrow">Example Gallery</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {guideExamples.map((example) => (
                <button
                  key={example.id}
                  className={`rounded-2xl border px-3 py-2 text-sm transition ${
                    selectedExample.id === example.id
                      ? 'border-cyan-300/30 bg-cyan-400/[0.06] text-cyan-100'
                      : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-300/20'
                  }`}
                  onClick={() => setSelectedExampleId(example.id)}
                  type="button"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-subtle">
            <div className="eyebrow">Live Example Preview</div>
            <h3 className="mt-2 text-lg font-semibold text-white">{selectedExample.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{selectedExample.summary}</p>
            <div className="mt-4 space-y-3">
              {selectedExample.preview.map((line) => (
                <div key={line} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono text-sm text-slate-300">
                  {line}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedExample.placeholders.map((placeholder) => (
                <span key={placeholder} className="badge-neutral">
                  <code>{placeholder}</code>
                </span>
              ))}
            </div>
          </div>

          <div className="panel-subtle">
            <div className="eyebrow">Template Lint Panel</div>
            <div className="mt-4 space-y-3">
              {lintNotes.map((note) => (
                <div key={note} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                  {note.includes('malformed') ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  )}
                  <div>{note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
