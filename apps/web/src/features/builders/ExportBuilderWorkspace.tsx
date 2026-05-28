import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderTree,
  Plus,
  Play,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  addExportBuilderSubTemplate,
  analyzeExportBuilderTemplate,
  autoMapExportBuilderConfig,
  createExportBuilderConfig,
  deleteExportBuilderConfig,
  duplicateExportBuilderConfig,
  getExportBuilderConfig,
  importExportBuilderMappings,
  listExportBuilderConfigs,
  saveExportBuilderConfig,
  testExportBuilderConfig,
} from './exportApi';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  ExportBuilderDetail,
  ExportBuilderSummary,
  ExportModule,
  ExportType,
  FieldCatalogNode,
  FilterRow,
  MappingRow,
  RenderType,
  StarterTemplate,
  SubTemplate,
} from './exportTypes';

type PrimaryTab = 'setup' | 'mappings' | 'subtemplates' | 'gallery' | 'preview';

const renderTypes: RenderType[] = [
  'Text',
  'RTF / HTML',
  'Date (MM/DD/YYYY)',
  'Date (YYYY-MM-DD)',
  'Date (MMMM d yyyy)',
  'Date Time',
  'UTC Date',
  'Relative Date',
  'Checkbox',
  'Checkbox YES/NO',
  'Boolean Yes/No',
  'Number',
  'Decimal',
  'File Name',
  'Image',
  'Multi Selection',
  'DataObject JSON',
  'DataObject Table',
];

const defaultExportModules: ExportModule[] = ['Security Plans', 'Security Controls', 'Risks', 'Assets', 'Master Assessments', 'Evidence'];

const filterFieldOptions = [
  'status',
  'owner',
  'lastUpdated',
  'maturityLevel',
  'evidenceCount',
  'currentUser',
];

const filterOperators = [
  'Equals',
  'Does Not Equal',
  'Contains',
  'Does Not Contain',
  'Greater Than',
  'Less Than',
  'Between',
  'Before',
  'After',
  'Within Last',
  'Within Next',
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function flattenFieldCatalog(nodes: FieldCatalogNode[]): Array<{ id: string; path: string; helper?: string }> {
  const flat: Array<{ id: string; path: string; helper?: string }> = [];
  for (const node of nodes) {
    if (node.path) {
      flat.push({ id: node.id, path: node.path, helper: node.helper });
    }
    if (node.children?.length) {
      flat.push(...flattenFieldCatalog(node.children));
    }
  }
  return flat;
}

function exportPayload(detail: ExportBuilderDetail) {
  return {
    title: detail.title,
    status: detail.status,
    module: detail.module,
    exportGroup: detail.exportGroup,
    exportType: detail.exportType,
    description: detail.description,
    templateFileName: detail.templateFileName,
    templateAnalysis: detail.templateAnalysis,
    mappings: detail.mappings,
    filterRows: detail.filterRows,
    filterExpression: detail.filterExpression,
    subTemplates: detail.subTemplates,
  };
}

function emptyFilterRow(): FilterRow {
  return {
    id: crypto.randomUUID(),
    field: 'status',
    operator: 'Equals',
    value: 'Active',
  };
}

function moduleContextCopy(module: ExportModule) {
  switch (module) {
    case 'Master Assessments':
      return 'Assessment-context mode is active. Use master-assessment fields when you need SAP, SAR, or assessment-aware package generation.';
    case 'Security Controls':
      return 'Control-register mode is active. Focus mappings on implementation status, responsible roles, assessment posture, and evidence-ready control details.';
    case 'Risks':
      return 'Risk-register mode is active. Focus mappings on scoring, ownership, mitigation, and due-date rollups.';
    case 'Assets':
      return 'Asset-inventory mode is active. Focus mappings on asset identity, platform details, ownership, location, and classification.';
    case 'Evidence':
      return 'Evidence mode is active. Use evidence-centric tags, files, and supporting artifacts for export generation.';
    case 'Security Plans':
    default:
      return 'Security-plan mode is active. Use plan metadata, system-owner details, and implementation narrative fields for narrative document generation.';
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlToSearchableText(xml: string) {
  return decodeXmlEntities(xml.replace(/<[^>]+>/g, ''));
}

async function inflateRaw(bytes: Uint8Array) {
  if ('DecompressionStream' in globalThis) {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return bytes;
}

function findEndOfCentralDirectory(view: DataView) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

async function extractZipXmlText(buffer: ArrayBuffer, format: ExportType) {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    return '';
  }

  const decoder = new TextDecoder();
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const xmlTexts: string[] = [];
  let cursor = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (cursor < end && view.getUint32(cursor, true) === 0x02014b50) {
    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const fileNameBytes = new Uint8Array(buffer, cursor + 46, fileNameLength);
    const fileName = decoder.decode(fileNameBytes);
    const isDocxXml =
      format === 'DOCX' &&
      /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(fileName);
    const isXlsxXml =
      format === 'XLSX' &&
      /^xl\/(sharedStrings|worksheets\/sheet\d+|tables\/table\d+)\.xml$/i.test(fileName);

    if ((isDocxXml || isXlsxXml) && view.getUint32(localHeaderOffset, true) === 0x04034b50) {
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedBytes = new Uint8Array(buffer, dataOffset, compressedSize);
      const xmlBytes =
        compressionMethod === 8 ? await inflateRaw(compressedBytes) : compressionMethod === 0 ? compressedBytes : null;
      if (xmlBytes) {
        const xml = decoder.decode(xmlBytes);
        xmlTexts.push(xml, xmlToSearchableText(xml));
      }
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return xmlTexts.join('\n');
}

async function readTemplateContent(file: File) {
  const lowerName = file.name.toLowerCase();
  const format = lowerName.endsWith('.xlsx') ? 'XLSX' : lowerName.endsWith('.docx') ? 'DOCX' : null;
  if (format) {
    try {
      const xmlText = await extractZipXmlText(await file.arrayBuffer(), format);
      if (xmlText.trim()) {
        return xmlText;
      }
    } catch {
      // Fall back to text mode so tests and hand-authored lightweight fixtures still work.
    }
  }
  return file.text();
}

export function ExportBuilderWorkspace() {
  const { identity } = useEdgeIdentity();
  const [exports, setExports] = useState<ExportBuilderSummary[]>([]);
  const [fieldCatalog, setFieldCatalog] = useState<FieldCatalogNode[]>([]);
  const [starterTemplates, setStarterTemplates] = useState<StarterTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExportBuilderDetail | null>(null);
  const [draft, setDraft] = useState<ExportBuilderDetail | null>(null);
  const [search, setSearch] = useState('');
  const [newExportTitle, setNewExportTitle] = useState('');
  const [newStarterTemplateId, setNewStarterTemplateId] = useState('');
  const [newSubTemplateTitle, setNewSubTemplateTitle] = useState('');
  const [pendingSubTemplateId, setPendingSubTemplateId] = useState<string | null>(null);
  const [testScenarioName, setTestScenarioName] = useState('FedRAMP readiness review');
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PrimaryTab>('setup');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const templateUploadRef = useRef<HTMLInputElement | null>(null);
  const mappingImportRef = useRef<HTMLInputElement | null>(null);
  const subTemplateUploadRef = useRef<HTMLInputElement | null>(null);

  async function loadExports() {
    try {
      setLoading(true);
      setError(null);
      const next = await listExportBuilderConfigs();
      setExports(next.exports);
      setFieldCatalog(next.fieldCatalog);
      setStarterTemplates(next.starterTemplates);
      setSelectedId((current) => current ?? next.exports[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Export Builder definitions.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(exportId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getExportBuilderConfig(exportId);
      setDetail(next);
      setDraft(clone(next));
      setSelectedMappingId(next.mappings[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Export Builder detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadExports();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (draft && !draft.mappings.some((mapping) => mapping.id === selectedMappingId)) {
      setSelectedMappingId(draft.mappings[0]?.id ?? null);
    }
  }, [draft, selectedMappingId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!detail || !draft) {
      return false;
    }
    return JSON.stringify(exportPayload(detail)) !== JSON.stringify(exportPayload(draft));
  }, [detail, draft]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Exports',
        value: exports.length,
        detail: 'Cloudflare-backed export configurations available to this tenant.',
      },
      {
        label: 'Mapped Tags',
        value: draft?.templateAnalysis.mappedTags ?? 0,
        detail: 'Template placeholders with an accepted field assignment.',
      },
      {
        label: 'Sub Templates',
        value: draft?.subTemplates.length ?? 0,
        detail: 'Appendices and companion sections managed independently.',
      },
      {
        label: 'Test Runs',
        value: draft?.testRuns.length ?? 0,
        detail: 'Recent preview generations recorded in the canonical runtime.',
      },
    ];
  }, [draft, exports.length]);

  const filteredExports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return exports;
    }
    return exports.filter((item) =>
      [item.title, item.module, item.exportGroup, item.exportType, item.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [exports, search]);

  const flatFields = useMemo(() => flattenFieldCatalog(draft?.fieldCatalog ?? fieldCatalog), [draft, fieldCatalog]);

  const exportModules = useMemo(
    () =>
      Array.from(
        new Set([
          ...defaultExportModules,
          ...starterTemplates.map((template) => template.module),
          ...(draft?.module ? [draft.module] : []),
        ]),
      ).sort(),
    [draft?.module, starterTemplates],
  );

  const selectedMapping = useMemo(
    () => draft?.mappings.find((mapping) => mapping.id === selectedMappingId) ?? draft?.mappings[0] ?? null,
    [draft, selectedMappingId],
  );

  async function refreshLibraryAndDetail(nextSelectedId?: string) {
    const previousId = nextSelectedId ?? selectedId;
    await loadExports();
    if (previousId) {
      await loadDetail(previousId);
    }
  }

  async function handleCreateExport() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createExportBuilderConfig({
        title: newExportTitle || undefined,
        starterTemplateId: newStarterTemplateId || null,
      });
      setNewExportTitle('');
      setNewStarterTemplateId('');
      await loadExports();
      setSelectedId(created.id);
      setActiveTab('setup');
      setNotice('New export configuration created in the canonical Export Builder service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create export configuration.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = await saveExportBuilderConfig(draft.id, exportPayload(draft));
      setDetail(saved);
      setDraft(clone(saved));
      await loadExports();
      setNotice('Export Builder definition saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save export configuration.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('duplicate');
      setError(null);
      setNotice(null);
      const duplicated = await duplicateExportBuilderConfig(draft.id);
      await loadExports();
      setSelectedId(duplicated.id);
      setNotice('Export configuration duplicated for customization.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to duplicate export configuration.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!draft) {
      return;
    }
    const confirmation = window.prompt(`Type "${draft.title}" to confirm delete.`);
    if (confirmation !== draft.title) {
      setNotice('Delete cancelled.');
      return;
    }
    try {
      setBusyAction('delete');
      setError(null);
      setNotice(null);
      await deleteExportBuilderConfig(draft.id);
      setSelectedId(null);
      await loadExports();
      setNotice('Export configuration deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete export configuration.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAnalyzeTemplate(file: File, subTemplateId?: string | null) {
    if (!draft) {
      return;
    }
    try {
      setBusyAction(subTemplateId ? `subtemplate:${subTemplateId}` : 'analyze-template');
      setError(null);
      setNotice(null);
      const content = await readTemplateContent(file);
      const analyzed = await analyzeExportBuilderTemplate(draft.id, {
        fileName: file.name,
        content,
        subTemplateId: subTemplateId ?? null,
      });
      setDetail(analyzed);
      setDraft(clone(analyzed));
      await loadExports();
      setNotice(
        subTemplateId
          ? 'Sub-template analyzed and mapped.'
          : 'Template analyzed, placeholders extracted, and mapping suggestions prepared.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze template.');
    } finally {
      setBusyAction(null);
      setPendingSubTemplateId(null);
      if (templateUploadRef.current) {
        templateUploadRef.current.value = '';
      }
      if (subTemplateUploadRef.current) {
        subTemplateUploadRef.current.value = '';
      }
    }
  }

  async function handleAutoMap() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('auto-map');
      setError(null);
      setNotice(null);
      const updated = await autoMapExportBuilderConfig(draft.id, { mappings: draft.mappings });
      setDetail(updated);
      setDraft(clone(updated));
      setNotice('Auto-mapping refreshed with Cloudflare-backed matching heuristics.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh auto mappings.');
    } finally {
      setBusyAction(null);
    }
  }

  function handleExportMappings() {
    if (!draft) {
      return;
    }
    const payload = {
      mappings: draft.mappings,
      filterRows: draft.filterRows,
      filterExpression: draft.filterExpression,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-field-mappings.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Field mappings exported to JSON.');
  }

  async function handleImportMappings(file: File) {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('import-mappings');
      setError(null);
      setNotice(null);
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        mappings?: MappingRow[];
        filterRows?: FilterRow[];
        filterExpression?: string;
      };
      const updated = await importExportBuilderMappings(draft.id, {
        mappings: parsed.mappings ?? [],
        filterRows: parsed.filterRows ?? draft.filterRows,
        filterExpression: parsed.filterExpression ?? draft.filterExpression,
      });
      setDetail(updated);
      setDraft(clone(updated));
      setNotice('Field mappings imported and validated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import field mappings.');
    } finally {
      setBusyAction(null);
      if (mappingImportRef.current) {
        mappingImportRef.current.value = '';
      }
    }
  }

  async function handleAddSubTemplate(file: File) {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('add-subtemplate');
      setError(null);
      setNotice(null);
      const content = await readTemplateContent(file);
      const updated = await addExportBuilderSubTemplate(draft.id, {
        title: newSubTemplateTitle || undefined,
        fileName: file.name,
        content,
      });
      setDetail(updated);
      setDraft(clone(updated));
      setNewSubTemplateTitle('');
      setNotice('DOCX sub-template added with its own mapping workflow.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add sub-template.');
    } finally {
      setBusyAction(null);
      if (subTemplateUploadRef.current) {
        subTemplateUploadRef.current.value = '';
      }
    }
  }

  async function handleTest() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('test');
      setError(null);
      setNotice(null);
      const response = await testExportBuilderConfig(draft.id, {
        scenarioName: testScenarioName || undefined,
      });
      const refreshed = await getExportBuilderConfig(draft.id);
      setDetail(refreshed);
      setDraft(clone(refreshed));
      setNotice(`Preview run ${response.runId} completed and was stored in D1.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run export preview.');
    } finally {
      setBusyAction(null);
    }
  }

  function updateMapping(mappingId: string, patch: Partial<MappingRow>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            mappings: current.mappings.map((mapping) =>
              mapping.id === mappingId ? { ...mapping, ...patch } : mapping,
            ),
          }
        : current,
    );
  }

  function updateSubTemplateMapping(subTemplateId: string, mappingId: string, patch: Partial<MappingRow>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            subTemplates: current.subTemplates.map((template) =>
              template.id === subTemplateId
                ? {
                    ...template,
                    mappings: template.mappings.map((mapping) =>
                      mapping.id === mappingId ? { ...mapping, ...patch } : mapping,
                    ),
                  }
                : template,
            ),
          }
        : current,
    );
  }

  function updateSubTemplate(subTemplateId: string, patch: Partial<SubTemplate>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            subTemplates: current.subTemplates.map((template) =>
              template.id === subTemplateId ? { ...template, ...patch } : template,
            ),
          }
        : current,
    );
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Export Builder...</div>;
  }

  return (
    <div className="space-y-6">
      <input
        ref={templateUploadRef}
        className="hidden"
        type="file"
        accept=".docx,.xlsx"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleAnalyzeTemplate(file);
          }
        }}
      />
      <input
        ref={mappingImportRef}
        className="hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImportMappings(file);
          }
        }}
      />
      <input
        ref={subTemplateUploadRef}
        className="hidden"
        type="file"
        accept=".docx"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            if (pendingSubTemplateId) {
              void handleAnalyzeTemplate(file, pendingSubTemplateId);
            } else {
              void handleAddSubTemplate(file);
            }
          }
        }}
      />

      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Export Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Build customized DOCX and XLSX exports by mapping Regovise fields to placeholder tags,
              applying advanced filters, and generating compliance-ready document packages directly
              from the canonical Cloudflare runtime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/builders/export-builder">
              <FileCheck2 className="mr-2 h-4 w-4" />
              Export Builder
            </Link>
            <button className="button-secondary" onClick={() => void handleDuplicate()} type="button">
              <Copy className="mr-2 h-4 w-4" />
              {busyAction === 'duplicate' ? 'Duplicating...' : 'Duplicate'}
            </button>
            <button className="button-secondary" onClick={() => void handleTest()} type="button">
              <Play className="mr-2 h-4 w-4" />
              {busyAction === 'test' ? 'Testing...' : 'Test Export'}
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Export Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Configurations</h2>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              className="input pl-10"
              placeholder="Search exports"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateExport();
            }}
          >
            <input
              className="input"
              placeholder="New export title"
              value={newExportTitle}
              onChange={(event) => setNewExportTitle(event.target.value)}
            />
            <select
              className="input"
              value={newStarterTemplateId}
              onChange={(event) => setNewStarterTemplateId(event.target.value)}
            >
              <option value="">Start blank</option>
              {starterTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <button className="button-secondary w-full" disabled={saving} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Create New Export
            </button>
          </form>
          <div className="space-y-3">
            {filteredExports.map((item) => (
              <button
                key={item.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === item.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                }`}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {item.module} · {item.exportType}
                    </div>
                  </div>
                  <span className={item.status === 'Active' ? 'badge-success' : 'badge-neutral'}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge-neutral">{item.exportGroup}</span>
                  <span className="badge-neutral">{item.tags} tags</span>
                  <span className="badge-neutral">{item.mappings} mappings</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">Updated {formatDate(item.lastUpdated)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-slate-300">Loading export definition...</div>
          ) : (
            <div className="space-y-6">
              <div className="panel-subtle">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="eyebrow">Export Summary</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">{draft.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={draft.status === 'Active' ? 'badge-success' : 'badge-neutral'}>
                        {draft.status}
                      </span>
                      <span className="badge-neutral">{draft.module}</span>
                      <span className="badge-neutral">{draft.exportType}</span>
                      <span className="badge-neutral">{draft.exportGroup}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary" onClick={() => templateUploadRef.current?.click()} type="button">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Template
                    </button>
                    <button className="button-secondary" onClick={() => void handleAutoMap()} type="button">
                      <WandSparkles className="mr-2 h-4 w-4" />
                      {busyAction === 'auto-map' ? 'Auto Mapping...' : 'Auto Map Fields'}
                    </button>
                    <button className="button-secondary" onClick={() => void handleDelete()} type="button">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                {draft.templateAnalysis.issues.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div className="space-y-1">
                        {draft.templateAnalysis.issues.map((issue) => (
                          <div key={issue}>{issue}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PrimaryTab)}>
                <TabsList className="mb-6 w-fit rounded-2xl border border-white/10 bg-slate-950/70">
                  <TabsTrigger value="setup">Setup</TabsTrigger>
                  <TabsTrigger value="mappings">Export Mappings</TabsTrigger>
                  <TabsTrigger value="subtemplates">Sub Templates</TabsTrigger>
                  <TabsTrigger value="gallery">Template Gallery</TabsTrigger>
                  <TabsTrigger value="preview">Preview & Tests</TabsTrigger>
                </TabsList>

                <TabsContent value="setup" className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Export Title</label>
                      <input
                        className="input mt-2"
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select
                        className="input mt-2"
                        value={draft.status}
                        onChange={(event) =>
                          setDraft({ ...draft, status: event.target.value as ExportBuilderDetail['status'] })
                        }
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Module</label>
                      <select
                        className="input mt-2"
                        value={draft.module}
                        onChange={(event) =>
                          setDraft({ ...draft, module: event.target.value as ExportModule })
                        }
                      >
                        {exportModules.map((module) => (
                          <option key={module} value={module}>
                            {module}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Export Group</label>
                      <input
                        className="input mt-2"
                        value={draft.exportGroup}
                        onChange={(event) => setDraft({ ...draft, exportGroup: event.target.value })}
                      />
                      <div className="mt-2 text-xs text-slate-500">
                        Type a new value here to create a custom group, equivalent to "Add New Group" in classic RegScale.
                      </div>
                    </div>
                    <div>
                      <label className="label">Export Type</label>
                      <select
                        className="input mt-2"
                        value={draft.exportType}
                        onChange={(event) =>
                          setDraft({ ...draft, exportType: event.target.value as ExportType })
                        }
                      >
                        <option value="DOCX">DOCX</option>
                        <option value="XLSX">XLSX</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Template File</label>
                      <input
                        className="input mt-2"
                        value={draft.templateFileName ?? ''}
                        onChange={(event) => setDraft({ ...draft, templateFileName: event.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Description</label>
                      <textarea
                        className="input mt-2 min-h-[96px]"
                        value={draft.description ?? ''}
                        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="panel-subtle">
                      <div className="eyebrow">Template Analysis</div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tags Found</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.tagsFound}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Mapped</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.mappedTags}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Repeated Tags</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.repeatedTags}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tables Detected</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.tablesDetected}</div>
                        </div>
                      </div>
                    </div>

                    <div className="panel-subtle">
                      <div className="eyebrow">Module Context</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div>
                          Export Builder now supports security plan, security control, risk, asset,
                          master assessment, and evidence-oriented output models from the same mapping surface.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="badge-neutral">Narrative packages</span>
                          <span className="badge-neutral">Control matrices</span>
                          <span className="badge-neutral">Risk registers</span>
                          <span className="badge-neutral">Asset inventories</span>
                          <span className="badge-neutral">Component Control Implementations</span>
                          <span className="badge-neutral">DataObjects</span>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-slate-400">
                          {moduleContextCopy(draft.module)}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="mappings" className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="panel-subtle">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="eyebrow">Template Upload</div>
                            <h3 className="mt-2 text-lg font-semibold text-white">Analyze placeholders</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              Upload or browse for a DOCX or XLSX template to extract <code>{'{{field_name}}'}</code>{' '}
                              placeholders, detect table regions, and prepare mapping suggestions. The tag delimiter is
                              always double curly braces; other file types are rejected.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="button-secondary" onClick={() => templateUploadRef.current?.click()} type="button">
                              <Upload className="mr-2 h-4 w-4" />
                              {busyAction === 'analyze-template' ? 'Analyzing...' : 'Upload Template'}
                            </button>
                            <button className="button-secondary" onClick={() => mappingImportRef.current?.click()} type="button">
                              <Upload className="mr-2 h-4 w-4" />
                              Import Field Mappings
                            </button>
                            <button className="button-secondary" onClick={handleExportMappings} type="button">
                              <Download className="mr-2 h-4 w-4" />
                              Export Field Mappings
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tags Found</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.tagsFound}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Mapped</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.mappedTags}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Unmapped</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{draft.templateAnalysis.unmappedTags}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Detection Mode</div>
                          <div className="mt-2 text-sm font-medium text-white">
                            {draft.templateAnalysis.extractionMode === 'content-scan' ? 'Content scan' : 'Heuristic seed'}
                          </div>
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="eyebrow">Mapping Workspace</div>
                            <div className="mt-2 text-sm text-slate-300">
                              Review each placeholder, accept semantic suggestions, or override render settings.
                            </div>
                          </div>
                          <button className="button-secondary" onClick={() => void handleAutoMap()} type="button">
                            <WandSparkles className="mr-2 h-4 w-4" />
                            Refresh Auto Map
                          </button>
                        </div>
                        <div className="space-y-3">
                          {draft.mappings.map((mapping) => (
                            <div
                              key={mapping.id}
                              className={`rounded-2xl border p-4 transition ${
                                selectedMappingId === mapping.id
                                  ? 'border-cyan-300/30 bg-cyan-400/[0.04]'
                                  : 'border-white/10 bg-slate-950/60'
                              }`}
                            >
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <button
                                  className="text-left"
                                  onClick={() => setSelectedMappingId(mapping.id)}
                                  type="button"
                                >
                                  <div className="font-medium text-white">{mapping.tag}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {mapping.tableRegion} · Confidence {mapping.confidence}
                                  </div>
                                </button>
                                <div className="flex flex-wrap gap-2">
                                  {mapping.repeated && <span className="badge-neutral">Repeated</span>}
                                  {mapping.accepted && <span className="badge-success">Accepted</span>}
                                  {!mapping.fieldPath && <span className="badge-danger">Needs mapping</span>}
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px_140px]">
                                <select
                                  className="input"
                                  value={mapping.fieldPath ?? ''}
                                  onChange={(event) => {
                                    const match = flatFields.find((field) => field.path === event.target.value);
                                    updateMapping(mapping.id, {
                                      fieldPath: match?.path ?? null,
                                      fieldNodeId: match?.id ?? null,
                                      accepted: Boolean(match?.path),
                                    });
                                  }}
                                >
                                  <option value="">Select Regovise field</option>
                                  {flatFields.map((field) => (
                                    <option key={field.id} value={field.path}>
                                      {field.path}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="input"
                                  value={mapping.renderType}
                                  onChange={(event) =>
                                    updateMapping(mapping.id, {
                                      renderType: event.target.value as RenderType,
                                    })
                                  }
                                >
                                  {renderTypes.map((renderType) => (
                                    <option key={renderType} value={renderType}>
                                      {renderType}
                                    </option>
                                  ))}
                                </select>
                                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={mapping.accepted}
                                    onChange={(event) => updateMapping(mapping.id, { accepted: event.target.checked })}
                                  />
                                  Accept
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <aside className="space-y-4">
                      <div className="panel-subtle">
                        <div className="eyebrow">Selected Placeholder</div>
                        {selectedMapping ? (
                          <div className="mt-4 space-y-3">
                            <div className="font-medium text-white">{selectedMapping.tag}</div>
                            <div className="text-sm text-slate-400">
                              {selectedMapping.fieldPath ?? 'Choose a field from the browser to map this placeholder.'}
                            </div>
                            <div className="grid gap-2 text-sm text-slate-300">
                              <div>Render Type: {selectedMapping.renderType}</div>
                              <div>Region: {selectedMapping.tableRegion}</div>
                              <div>Confidence: {selectedMapping.confidence}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-slate-400">
                            Select a placeholder row to review mapping detail.
                          </div>
                        )}
                      </div>

                      <div className="panel-subtle">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="eyebrow">Advanced Filters</div>
                          <button
                            className="button-secondary"
                            onClick={() => setDraft({ ...draft, filterRows: [...draft.filterRows, emptyFilterRow()] })}
                            type="button"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Filter
                          </button>
                        </div>
                        <div className="space-y-3">
                          {draft.filterRows.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                              <div className="grid gap-3">
                                <select
                                  className="input"
                                  value={row.field}
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      filterRows: draft.filterRows.map((item) =>
                                        item.id === row.id ? { ...item, field: event.target.value } : item,
                                      ),
                                    })
                                  }
                                >
                                  {filterFieldOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="input"
                                  value={row.operator}
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      filterRows: draft.filterRows.map((item) =>
                                        item.id === row.id ? { ...item, operator: event.target.value } : item,
                                      ),
                                    })
                                  }
                                >
                                  {filterOperators.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="input"
                                  value={row.value}
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      filterRows: draft.filterRows.map((item) =>
                                        item.id === row.id ? { ...item, value: event.target.value } : item,
                                      ),
                                    })
                                  }
                                  placeholder="Filter value"
                                />
                                <button
                                  className="button-secondary"
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      filterRows: draft.filterRows.filter((item) => item.id !== row.id),
                                    })
                                  }
                                  type="button"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <label className="label">Filter Logic Expression</label>
                          <input
                            className="input mt-2"
                            value={draft.filterExpression}
                            onChange={(event) => setDraft({ ...draft, filterExpression: event.target.value })}
                            placeholder="1 AND (2 OR 3)"
                          />
                        </div>
                      </div>
                    </aside>
                  </div>
                </TabsContent>

                <TabsContent value="subtemplates" className="space-y-6">
                  <div className="panel-subtle">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="eyebrow">DOCX Sub Templates</div>
                        <h3 className="mt-2 text-lg font-semibold text-white">Appendices and companion sections</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Sub templates keep their own file, tag analysis, and field mappings for multi-part compliance packages.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="input w-56"
                          placeholder="Optional sub-template title"
                          value={newSubTemplateTitle}
                          onChange={(event) => setNewSubTemplateTitle(event.target.value)}
                        />
                        <button
                          className="button-secondary"
                          disabled={draft.exportType !== 'DOCX'}
                          onClick={() => {
                            setPendingSubTemplateId(null);
                            subTemplateUploadRef.current?.click();
                          }}
                          type="button"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {busyAction === 'add-subtemplate' ? 'Adding...' : 'Add Sub Template'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {draft.exportType !== 'DOCX' && (
                      <div className="panel-subtle text-sm text-amber-100">
                        Sub Templates are only supported for DOCX export configurations. Switch the export type to DOCX
                        before adding appendices or companion narrative sections.
                      </div>
                    )}
                    {draft.subTemplates.map((template) => (
                      <div key={template.id} className="panel-subtle">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="font-medium text-white">{template.title}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {template.fileName} · {template.analysis.tagsFound} tags · {template.analysis.mappedTags} mapped
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="badge-neutral">{template.status}</span>
                            <button
                              className="button-secondary"
                              onClick={() => {
                                setNewSubTemplateTitle(template.title);
                                setPendingSubTemplateId(template.id);
                                subTemplateUploadRef.current?.click();
                              }}
                              type="button"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Re-analyze
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  subTemplates: draft.subTemplates.filter((item) => item.id !== template.id),
                                })
                              }
                              type="button"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {template.analysis.issues.map((issue) => (
                            <div key={issue} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                              {issue}
                            </div>
                          ))}
                          {template.mappings.map((mapping) => (
                            <div key={mapping.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                  <div className="font-medium text-white">{mapping.tag}</div>
                                  <div className="mt-1 text-xs text-slate-500">{mapping.tableRegion}</div>
                                </div>
                                <select
                                  className="input xl:w-[340px]"
                                  value={mapping.fieldPath ?? ''}
                                  onChange={(event) => {
                                    const match = flatFields.find((field) => field.path === event.target.value);
                                    updateSubTemplateMapping(template.id, mapping.id, {
                                      fieldPath: match?.path ?? null,
                                      fieldNodeId: match?.id ?? null,
                                      accepted: Boolean(match?.path),
                                    });
                                  }}
                                >
                                  <option value="">Select Regovise field</option>
                                  {flatFields.map((field) => (
                                    <option key={field.id} value={field.path}>
                                      {field.path}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {draft.subTemplates.length === 0 && (
                      <div className="panel-subtle text-sm text-slate-400">
                        Add a DOCX appendix or companion narrative to manage its mappings separately from the primary export.
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="gallery" className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {draft.starterTemplates.map((template) => (
                      <div key={template.id} className="panel-subtle">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">{template.title}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {template.module} · {template.exportType}
                            </div>
                          </div>
                          <span className="badge-neutral">{template.kind}</span>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{template.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="badge-neutral">{template.exportGroup}</span>
                          <span className="badge-neutral">{template.defaultTags.length} starter tags</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="button-secondary"
                            onClick={async () => {
                              try {
                                setBusyAction(`starter:${template.id}`);
                                const created = await createExportBuilderConfig({
                                  starterTemplateId: template.id,
                                  title: `${template.title} Copy`,
                                });
                                await loadExports();
                                setSelectedId(created.id);
                                setActiveTab('setup');
                                setNotice(`${template.title} copied into a new export configuration.`);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Unable to copy starter template.');
                              } finally {
                                setBusyAction(null);
                              }
                            }}
                            type="button"
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            {busyAction === `starter:${template.id}` ? 'Copying...' : 'Copy & Customize'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="panel-subtle">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="eyebrow">Preview Generation</div>
                            <h3 className="mt-2 text-lg font-semibold text-white">Run a test export</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              Generate a preview summary for mapped and unmapped tags before publishing the export for operators.
                            </p>
                          </div>
                          <button className="button-primary" onClick={() => void handleTest()} type="button">
                            <Play className="mr-2 h-4 w-4" />
                            {busyAction === 'test' ? 'Generating...' : 'Run Test Export'}
                          </button>
                        </div>
                        <div className="mt-4">
                          <label className="label">Scenario Name</label>
                          <input
                            className="input mt-2"
                            value={testScenarioName}
                            onChange={(event) => setTestScenarioName(event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {draft.testRuns.map((run) => (
                          <div key={run.id} className="panel-subtle">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div>
                                <div className="font-medium text-white">{run.scenarioName}</div>
                                <div className="mt-1 text-sm text-slate-400">
                                  {run.result.generatedArtifactName} · {formatDate(run.createdAt)}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="badge-success">{run.status}</span>
                                <span className="badge-neutral">{run.result.mappedTags} mapped</span>
                                <span className="badge-neutral">{run.result.unmappedTags} unmapped</span>
                                <span className={run.result.filterExpressionValid ? 'badge-success' : 'badge-danger'}>
                                  filters {run.result.filterExpressionValid ? 'valid' : 'invalid'}
                                </span>
                                <span className="badge-neutral">{run.result.subTemplates} sub templates</span>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Generation Mode</div>
                                <div className="mt-2">{run.result.generationMode}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Data Sources</div>
                                <div className="mt-2">
                                  {run.result.dataSources.length > 0 ? run.result.dataSources.join(', ') : 'No mapped sources yet'}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Render Types</div>
                                <div className="mt-2">
                                  {run.result.renderTypes.length > 0 ? run.result.renderTypes.join(', ') : 'No render types'}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Master Assessment Mode</div>
                                <div className="mt-2">{run.result.masterAssessmentMode ? 'Enabled' : 'Not used'}</div>
                              </div>
                            </div>
                            {run.result.filterDiagnostics.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                                {run.result.filterDiagnostics.join(' ')}
                              </div>
                            )}
                            <div className="mt-4 space-y-2">
                              {run.result.previewLines.map((line) => (
                                <div key={line} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                                  {line}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {draft.testRuns.length === 0 && (
                          <div className="panel-subtle text-sm text-slate-400">
                            No preview runs yet. Use the test action to generate a mapping summary and artifact name.
                          </div>
                        )}
                      </div>
                    </div>

                    <aside className="space-y-4">
                      <div className="panel-subtle">
                        <div className="eyebrow">Checklist</div>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                            <div>Template uploaded and analyzed</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Braces className="mt-0.5 h-4 w-4 text-cyan-300" />
                            <div>Placeholder tags mapped to canonical Regovise fields</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Filter className="mt-0.5 h-4 w-4 text-cyan-300" />
                            <div>Filter expression reviewed for table and worksheet context</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <FolderTree className="mt-0.5 h-4 w-4 text-cyan-300" />
                            <div>DOCX sub templates added for appendices when needed</div>
                          </div>
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">Template Tips</div>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          <div>
                            Use <code>{'{{field_name}}'}</code> placeholders for direct mappings.
                          </div>
                          <div>
                            Use <code>{'{{SSP|SECURITYPLAN.SYSTEMOWNER.NAME}}'}</code> when authoring reusable DOCX templates.
                          </div>
                          <div>Image placeholders and repeating table rows still benefit from manual review before activation.</div>
                        </div>
                      </div>
                    </aside>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>
      </section>

      {hasUnsavedChanges && (
        <section className="panel sticky bottom-4 border-cyan-300/20 bg-slate-950/85 backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div>
                <div className="font-medium text-white">Unsaved changes</div>
                <div className="mt-1 text-sm text-slate-300">
                  Saving updates the export definition, field mappings, filters, and sub-template configuration globally for the tenant.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" onClick={() => void handleTest()} type="button">
                <Play className="mr-2 h-4 w-4" />
                Preview
              </button>
              <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
