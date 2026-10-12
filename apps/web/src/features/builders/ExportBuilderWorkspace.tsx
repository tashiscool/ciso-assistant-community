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
import { RegModal, RegRightDrawer } from '../../components/regovise/PagePrimitives';
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
type ExportBuilderReviewAction = 'duplicate' | 'test-preview' | 'auto-map' | 'export-mappings';
type PendingTemplateUpload = {
  file: File;
  mode: 'primary-template' | 'subtemplate-add' | 'subtemplate-reanalyze';
  subTemplateId?: string | null;
  subTemplateTitle?: string;
};

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

function reviewActionCopy(action: ExportBuilderReviewAction | null, draft: ExportBuilderDetail | null) {
  const title = draft?.title ?? 'this export configuration';
  switch (action) {
    case 'duplicate':
      return {
        title: 'Duplicate export configuration',
        description: `Review "${title}" before creating a separate copy for customization.`,
        body: 'The existing configuration stays unchanged. The copy starts from the current saved export definition, including mappings, filters, template metadata, and preview context.',
        confirmLabel: 'Duplicate export',
        busyKey: 'duplicate',
      };
    case 'test-preview':
      return {
        title: 'Run export preview',
        description: `Review "${title}" before generating a new preview run.`,
        body: 'This creates a preview test run in the canonical Export Builder runtime. It does not publish the export or change the saved definition.',
        confirmLabel: 'Run preview',
        busyKey: 'test',
      };
    case 'auto-map':
      return {
        title: 'Refresh auto map',
        description: `Review "${title}" before refreshing field suggestions.`,
        body: 'Auto-map uses the current draft mappings and Cloudflare-backed matching heuristics to refresh suggested field assignments. Review the mapping workspace before saving changes globally.',
        confirmLabel: 'Refresh mappings',
        busyKey: 'auto-map',
      };
    case 'export-mappings':
      return {
        title: 'Export field mappings',
        description: `Review "${title}" before downloading mapping JSON.`,
        body: 'This downloads the current draft mappings, filters, and filter expression as a local JSON file. No tenant data or saved configuration is changed.',
        confirmLabel: 'Download mappings',
        busyKey: null,
      };
    default:
      return {
        title: 'Review export action',
        description: undefined,
        body: 'Review this Export Builder action before continuing.',
        confirmLabel: 'Continue',
        busyKey: null,
      };
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
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [importMappingsDrawerOpen, setImportMappingsDrawerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingSubTemplateRemove, setPendingSubTemplateRemove] = useState<SubTemplate | null>(null);
  const [pendingStarterTemplateCopy, setPendingStarterTemplateCopy] = useState<StarterTemplate | null>(null);
  const [pendingReviewAction, setPendingReviewAction] = useState<ExportBuilderReviewAction | null>(null);
  const [pendingTemplateUpload, setPendingTemplateUpload] = useState<PendingTemplateUpload | null>(null);
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

  const pendingReviewCopy = useMemo(
    () => reviewActionCopy(pendingReviewAction, draft),
    [pendingReviewAction, draft],
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
      setCreateDrawerOpen(false);
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
    try {
      setBusyAction('delete');
      setError(null);
      setNotice(null);
      await deleteExportBuilderConfig(draft.id);
      setSelectedId(null);
      await loadExports();
      setDeleteModalOpen(false);
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
      setImportMappingsDrawerOpen(false);
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

  function handleRemoveSubTemplate(template: SubTemplate) {
    setDraft((current) =>
      current
        ? {
            ...current,
            subTemplates: current.subTemplates.filter((item) => item.id !== template.id),
          }
        : current,
    );
    setPendingSubTemplateRemove(null);
    setNotice(`Sub-template "${template.title}" removed from the draft. Save changes to persist the export update.`);
  }

  async function handleCopyStarterTemplate(template: StarterTemplate) {
    try {
      setBusyAction(`starter:${template.id}`);
      setError(null);
      setNotice(null);
      const created = await createExportBuilderConfig({
        starterTemplateId: template.id,
        title: `${template.title} Copy`,
      });
      await loadExports();
      setSelectedId(created.id);
      setActiveTab('setup');
      setPendingStarterTemplateCopy(null);
      setNotice(`${template.title} copied into a new export configuration.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to copy starter template.');
    } finally {
      setBusyAction(null);
    }
  }

  function resetFileInputs() {
    if (templateUploadRef.current) {
      templateUploadRef.current.value = '';
    }
    if (mappingImportRef.current) {
      mappingImportRef.current.value = '';
    }
    if (subTemplateUploadRef.current) {
      subTemplateUploadRef.current.value = '';
    }
  }

  function dismissTemplateUploadReview() {
    setPendingTemplateUpload(null);
    setPendingSubTemplateId(null);
    resetFileInputs();
  }

  async function confirmTemplateUploadReview() {
    const pending = pendingTemplateUpload;
    if (!pending) {
      return;
    }
    setPendingTemplateUpload(null);
    if (pending.mode === 'primary-template') {
      await handleAnalyzeTemplate(pending.file);
    } else if (pending.subTemplateId) {
      await handleAnalyzeTemplate(pending.file, pending.subTemplateId);
    } else {
      await handleAddSubTemplate(pending.file);
    }
  }

  async function confirmReviewAction() {
    const action = pendingReviewAction;
    setPendingReviewAction(null);
    switch (action) {
      case 'duplicate':
        await handleDuplicate();
        break;
      case 'test-preview':
        await handleTest();
        break;
      case 'auto-map':
        await handleAutoMap();
        break;
      case 'export-mappings':
        handleExportMappings();
        break;
      default:
        break;
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading Export Builder...</div>;
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
            setPendingTemplateUpload({
              file,
              mode: 'primary-template',
            });
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
              const selectedTemplate = draft?.subTemplates.find((template) => template.id === pendingSubTemplateId);
              setPendingTemplateUpload({
                file,
                mode: 'subtemplate-reanalyze',
                subTemplateId: pendingSubTemplateId,
                subTemplateTitle: selectedTemplate?.title ?? newSubTemplateTitle,
              });
            } else {
              setPendingTemplateUpload({
                file,
                mode: 'subtemplate-add',
                subTemplateTitle: newSubTemplateTitle || file.name,
              });
            }
          }
        }}
      />

      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Export Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
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
            <button className="button-secondary" onClick={() => setCreateDrawerOpen(true)} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Create Export
            </button>
            <button className="button-secondary" disabled={!draft} onClick={() => setPendingReviewAction('duplicate')} type="button">
              <Copy className="mr-2 h-4 w-4" />
              {busyAction === 'duplicate' ? 'Duplicating...' : 'Duplicate'}
            </button>
            <button className="button-secondary" disabled={!draft} onClick={() => setPendingReviewAction('test-preview')} type="button">
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
            <div className="mt-2 text-xs text-[#62576a]">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Export Library</div>
              <h2 className="mt-2 text-xl font-semibold text-[#241232]">Configurations</h2>
            </div>
            <Sparkles className="h-5 w-5 text-[#7a3ccf]" />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62576a]" />
            <input
              className="input pl-10"
              placeholder="Search exports"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="button-secondary w-full justify-center" onClick={() => setCreateDrawerOpen(true)} type="button">
            <Plus className="mr-2 h-4 w-4" />
            Create New Export
          </button>
          <div className="space-y-3">
            {filteredExports.map((item) => (
              <button
                key={item.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === item.id ? 'border-[#d7c3f1] bg-[#f6f1fa]' : 'hover:border-[#d7c3f1]'
                }`}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[#241232]">{item.title}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">
                      {item.module} · {item.exportType}
                    </div>
                  </div>
                  <span className={item.status === 'Active' ? 'status-pill-success' : 'status-pill-neutral'}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="status-pill-neutral">{item.exportGroup}</span>
                  <span className="status-pill-neutral">{item.tags} tags</span>
                  <span className="status-pill-neutral">{item.mappings} mappings</span>
                </div>
                <div className="mt-3 text-xs text-[#62576a]">Updated {formatDate(item.lastUpdated)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-[#4f435c]">Loading export definition...</div>
          ) : (
            <div className="space-y-6">
              <div className="panel-subtle">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="eyebrow">Export Summary</div>
                    <h3 className="mt-2 text-xl font-semibold text-[#241232]">{draft.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={draft.status === 'Active' ? 'status-pill-success' : 'status-pill-neutral'}>
                        {draft.status}
                      </span>
                      <span className="status-pill-neutral">{draft.module}</span>
                      <span className="status-pill-neutral">{draft.exportType}</span>
                      <span className="status-pill-neutral">{draft.exportGroup}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary" onClick={() => templateUploadRef.current?.click()} type="button">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Template
                    </button>
                    <button className="button-secondary" onClick={() => setPendingReviewAction('auto-map')} type="button">
                      <WandSparkles className="mr-2 h-4 w-4" />
                      {busyAction === 'auto-map' ? 'Auto Mapping...' : 'Auto Map Fields'}
                    </button>
                    <button className="button-secondary" onClick={() => setDeleteModalOpen(true)} type="button">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                {draft.templateAnalysis.issues.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#f6d48e] bg-[#fff2d9] p-4 text-sm text-[#8a4d00]">
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
                <TabsList className="mb-6 w-fit rounded-2xl border border-[#ded8e4] bg-white">
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
                      <div className="mt-2 text-xs text-[#62576a]">
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
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Tags Found</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.tagsFound}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Mapped</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.mappedTags}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Repeated Tags</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.repeatedTags}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Tables Detected</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.tablesDetected}</div>
                        </div>
                      </div>
                    </div>

                    <div className="panel-subtle">
                      <div className="eyebrow">Module Context</div>
                      <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
                        <div>
                          Export Builder now supports security plan, security control, risk, asset,
                          master assessment, and evidence-oriented output models from the same mapping surface.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="status-pill-neutral">Narrative packages</span>
                          <span className="status-pill-neutral">Control matrices</span>
                          <span className="status-pill-neutral">Risk registers</span>
                          <span className="status-pill-neutral">Asset inventories</span>
                          <span className="status-pill-neutral">Component Control Implementations</span>
                          <span className="status-pill-neutral">DataObjects</span>
                        </div>
                        <div className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-[#6f6578]">
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
                            <h3 className="mt-2 text-lg font-semibold text-[#241232]">Analyze placeholders</h3>
                            <p className="mt-2 text-sm leading-6 text-[#4f435c]">
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
                            <button className="button-secondary" onClick={() => setImportMappingsDrawerOpen(true)} type="button">
                              <Upload className="mr-2 h-4 w-4" />
                              Import Field Mappings
                            </button>
                            <button className="button-secondary" onClick={() => setPendingReviewAction('export-mappings')} type="button">
                              <Download className="mr-2 h-4 w-4" />
                              Export Field Mappings
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Tags Found</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.tagsFound}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Mapped</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.mappedTags}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Unmapped</div>
                          <div className="mt-2 text-2xl font-semibold text-[#241232]">{draft.templateAnalysis.unmappedTags}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Detection Mode</div>
                          <div className="mt-2 text-sm font-medium text-[#241232]">
                            {draft.templateAnalysis.extractionMode === 'content-scan' ? 'Content scan' : 'Heuristic seed'}
                          </div>
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="eyebrow">Mapping Workspace</div>
                            <div className="mt-2 text-sm text-[#4f435c]">
                              Review each placeholder, accept semantic suggestions, or override render settings.
                            </div>
                          </div>
                          <button className="button-secondary" onClick={() => setPendingReviewAction('auto-map')} type="button">
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
                                  ? 'border-[#d7c3f1] bg-[#f6f1fa]'
                                  : 'border-[#ded8e4] bg-white'
                              }`}
                            >
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <button
                                  className="text-left"
                                  onClick={() => setSelectedMappingId(mapping.id)}
                                  type="button"
                                >
                                  <div className="font-medium text-[#241232]">{mapping.tag}</div>
                                  <div className="mt-1 text-xs text-[#62576a]">
                                    {mapping.tableRegion} · Confidence {mapping.confidence}
                                  </div>
                                </button>
                                <div className="flex flex-wrap gap-2">
                                  {mapping.repeated && <span className="status-pill-neutral">Repeated</span>}
                                  {mapping.accepted && <span className="status-pill-success">Accepted</span>}
                                  {!mapping.fieldPath && <span className="status-pill-danger">Needs mapping</span>}
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
                                <label className="flex items-center gap-2 rounded-2xl border border-[#ded8e4] bg-white px-3 text-sm text-[#4f435c]">
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
                            <div className="font-medium text-[#241232]">{selectedMapping.tag}</div>
                            <div className="text-sm text-[#6f6578]">
                              {selectedMapping.fieldPath ?? 'Choose a field from the browser to map this placeholder.'}
                            </div>
                            <div className="grid gap-2 text-sm text-[#4f435c]">
                              <div>Render Type: {selectedMapping.renderType}</div>
                              <div>Region: {selectedMapping.tableRegion}</div>
                              <div>Confidence: {selectedMapping.confidence}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-[#6f6578]">
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
                            <div key={row.id} className="rounded-2xl border border-[#ded8e4] bg-white p-3">
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
                        <h3 className="mt-2 text-lg font-semibold text-[#241232]">Appendices and companion sections</h3>
                        <p className="mt-2 text-sm leading-6 text-[#4f435c]">
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
                      <div className="panel-subtle text-sm text-[#8a4d00]">
                        Sub Templates are only supported for DOCX export configurations. Switch the export type to DOCX
                        before adding appendices or companion narrative sections.
                      </div>
                    )}
                    {draft.subTemplates.map((template) => (
                      <div key={template.id} className="panel-subtle">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="font-medium text-[#241232]">{template.title}</div>
                            <div className="mt-1 text-sm text-[#6f6578]">
                              {template.fileName} · {template.analysis.tagsFound} tags · {template.analysis.mappedTags} mapped
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="status-pill-neutral">{template.status}</span>
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
                              onClick={() => setPendingSubTemplateRemove(template)}
                              type="button"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {template.analysis.issues.map((issue) => (
                            <div key={issue} className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-sm text-[#4f435c]">
                              {issue}
                            </div>
                          ))}
                          {template.mappings.map((mapping) => (
                            <div key={mapping.id} className="rounded-2xl border border-[#ded8e4] bg-white p-3">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                  <div className="font-medium text-[#241232]">{mapping.tag}</div>
                                  <div className="mt-1 text-xs text-[#62576a]">{mapping.tableRegion}</div>
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
                      <div className="panel-subtle text-sm text-[#6f6578]">
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
                            <div className="font-medium text-[#241232]">{template.title}</div>
                            <div className="mt-1 text-sm text-[#6f6578]">
                              {template.module} · {template.exportType}
                            </div>
                          </div>
                          <span className="status-pill-neutral">{template.kind}</span>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[#4f435c]">{template.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="status-pill-neutral">{template.exportGroup}</span>
                          <span className="status-pill-neutral">{template.defaultTags.length} starter tags</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="button-secondary"
                            onClick={() => setPendingStarterTemplateCopy(template)}
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
                            <h3 className="mt-2 text-lg font-semibold text-[#241232]">Run a test export</h3>
                            <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                              Generate a preview summary for mapped and unmapped tags before publishing the export for operators.
                            </p>
                          </div>
                          <button className="button-primary" onClick={() => setPendingReviewAction('test-preview')} type="button">
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
                                <div className="font-medium text-[#241232]">{run.scenarioName}</div>
                                <div className="mt-1 text-sm text-[#6f6578]">
                                  {run.result.generatedArtifactName} · {formatDate(run.createdAt)}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="status-pill-success">{run.status}</span>
                                <span className="status-pill-neutral">{run.result.mappedTags} mapped</span>
                                <span className="status-pill-neutral">{run.result.unmappedTags} unmapped</span>
                                <span className={run.result.filterExpressionValid ? 'status-pill-success' : 'status-pill-danger'}>
                                  filters {run.result.filterExpressionValid ? 'valid' : 'invalid'}
                                </span>
                                <span className="status-pill-neutral">{run.result.subTemplates} sub templates</span>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-sm text-[#4f435c]">
                                <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Generation Mode</div>
                                <div className="mt-2">{run.result.generationMode}</div>
                              </div>
                              <div className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-sm text-[#4f435c]">
                                <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Data Sources</div>
                                <div className="mt-2">
                                  {run.result.dataSources.length > 0 ? run.result.dataSources.join(', ') : 'No mapped sources yet'}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-sm text-[#4f435c]">
                                <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Render Types</div>
                                <div className="mt-2">
                                  {run.result.renderTypes.length > 0 ? run.result.renderTypes.join(', ') : 'No render types'}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-sm text-[#4f435c]">
                                <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Master Assessment Mode</div>
                                <div className="mt-2">{run.result.masterAssessmentMode ? 'Enabled' : 'Not used'}</div>
                              </div>
                            </div>
                            {run.result.filterDiagnostics.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-[#f6d48e] bg-[#fff2d9] p-3 text-sm text-[#8a4d00]">
                                {run.result.filterDiagnostics.join(' ')}
                              </div>
                            )}
                            <div className="mt-4 space-y-2">
                              {run.result.previewLines.map((line) => (
                                <div key={line} className="rounded-2xl border border-[#ded8e4] bg-white p-3 text-sm text-[#4f435c]">
                                  {line}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {draft.testRuns.length === 0 && (
                          <div className="panel-subtle text-sm text-[#6f6578]">
                            No preview runs yet. Use the test action to generate a mapping summary and artifact name.
                          </div>
                        )}
                      </div>
                    </div>

                    <aside className="space-y-4">
                      <div className="panel-subtle">
                        <div className="eyebrow">Checklist</div>
                        <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#7a3ccf]" />
                            <div>Template uploaded and analyzed</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Braces className="mt-0.5 h-4 w-4 text-[#7a3ccf]" />
                            <div>Placeholder tags mapped to canonical Regovise fields</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Filter className="mt-0.5 h-4 w-4 text-[#7a3ccf]" />
                            <div>Filter expression reviewed for table and worksheet context</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <FolderTree className="mt-0.5 h-4 w-4 text-[#7a3ccf]" />
                            <div>DOCX sub templates added for appendices when needed</div>
                          </div>
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">Template Tips</div>
                        <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
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
        <section className="panel sticky bottom-4 border-[#d7c3f1] bg-white backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[#8a4d00]" />
              <div>
                <div className="font-medium text-[#241232]">Unsaved changes</div>
                <div className="mt-1 text-sm text-[#4f435c]">
                  Saving updates the export definition, field mappings, filters, and sub-template configuration globally for the tenant.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" onClick={() => setPendingReviewAction('test-preview')} type="button">
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
      <RegRightDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        title="Create export configuration"
        description="Start from a blank DOCX/XLSX definition or copy one of the curated starter templates."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setCreateDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleCreateExport()} type="button">
              <Plus className="mr-2 h-4 w-4" />
              {saving ? 'Creating...' : 'Create export'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label">Export title</label>
            <input
              className="input mt-2"
              placeholder="Security plan export"
              value={newExportTitle}
              onChange={(event) => setNewExportTitle(event.target.value)}
            />
          </div>
          <div>
            <label className="label">Starter template</label>
            <select
              className="input mt-2"
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
          </div>
          <div className="panel-subtle text-sm leading-6 text-[#4f435c]">
            New configurations preserve the existing Export Builder runtime contract. You can upload templates,
            map placeholders, import mappings, and run test exports after creation.
          </div>
        </div>
      </RegRightDrawer>

      <RegRightDrawer
        open={importMappingsDrawerOpen}
        onOpenChange={setImportMappingsDrawerOpen}
        title="Import field mappings"
        description="Review the expected mapping payload before selecting a JSON file to import into this export definition."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setImportMappingsDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!draft || busyAction === 'import-mappings'}
              onClick={() => mappingImportRef.current?.click()}
              type="button"
            >
              <Upload className="mr-2 h-4 w-4" />
              {busyAction === 'import-mappings' ? 'Importing...' : 'Select JSON file'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="panel-subtle">
            <div className="eyebrow">Expected payload</div>
            <pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-[#ded8e4] bg-white p-4 text-xs leading-5 text-[#241232]">
{`{
  "mappings": [{ "tag": "{{owner}}", "fieldPath": "controls.owner" }],
  "filterRows": [],
  "filterExpression": "1 AND 2"
}`}
            </pre>
          </div>
          <div className="text-sm leading-6 text-[#4f435c]">
            Imported mappings are validated by the existing Export Builder service before they replace the current
            mapping and filter draft. Save changes after reviewing the imported assignments.
          </div>
        </div>
      </RegRightDrawer>

      <RegModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete export configuration"
        description={draft ? `This permanently removes "${draft.title}" from the tenant export library.` : undefined}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setDeleteModalOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-secondary border-[#f1b7bd] text-[#a51f2b] hover:border-[#df7d89] hover:bg-[#fff3f4]"
              disabled={busyAction === 'delete'}
              onClick={() => void handleDelete()}
              type="button"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {busyAction === 'delete' ? 'Deleting...' : 'Delete export'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-[#4f435c]">
          <p>
            This action removes the export definition, its mapping draft, filters, sub-template configuration, and
            recent preview history from this tenant's Export Builder library.
          </p>
          <p>Duplicate the export first if operators may need the current mapping setup later.</p>
        </div>
      </RegModal>
      <RegModal
        open={Boolean(pendingSubTemplateRemove)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSubTemplateRemove(null);
          }
        }}
        title="Remove sub-template"
        description={
          pendingSubTemplateRemove
            ? `Review the DOCX appendix before removing "${pendingSubTemplateRemove.title}" from this export draft.`
            : undefined
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setPendingSubTemplateRemove(null)} type="button">
              Cancel
            </button>
            <button
              className="button-secondary border-[#f1b7bd] text-[#a51f2c] hover:border-[#df7d89] hover:bg-[#fff3f4]"
              disabled={!pendingSubTemplateRemove}
              onClick={() => pendingSubTemplateRemove && handleRemoveSubTemplate(pendingSubTemplateRemove)}
              type="button"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove sub-template
            </button>
          </div>
        }
      >
        {pendingSubTemplateRemove ? (
          <div className="space-y-3 text-sm leading-6 text-[#4f435c]">
            <p>
              Removing this sub-template also removes its analyzed tags, field mappings, template file metadata,
              and companion-section preview context from the draft.
            </p>
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{pendingSubTemplateRemove.title}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">{pendingSubTemplateRemove.status}</span>
                <span className="status-pill-neutral">{pendingSubTemplateRemove.fileName}</span>
                <span className="status-pill-neutral">{pendingSubTemplateRemove.analysis.tagsFound} tags</span>
                <span className="status-pill-neutral">{pendingSubTemplateRemove.mappings.length} mappings</span>
              </div>
            </div>
          </div>
        ) : null}
      </RegModal>
      <RegModal
        open={Boolean(pendingStarterTemplateCopy)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStarterTemplateCopy(null);
          }
        }}
        title="Copy starter template"
        description={
          pendingStarterTemplateCopy
            ? `Review "${pendingStarterTemplateCopy.title}" before creating a new export configuration.`
            : undefined
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setPendingStarterTemplateCopy(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={
                !pendingStarterTemplateCopy || busyAction === `starter:${pendingStarterTemplateCopy.id}`
              }
              onClick={() => pendingStarterTemplateCopy && void handleCopyStarterTemplate(pendingStarterTemplateCopy)}
              type="button"
            >
              <Copy className="mr-2 h-4 w-4" />
              {pendingStarterTemplateCopy && busyAction === `starter:${pendingStarterTemplateCopy.id}`
                ? 'Copying...'
                : 'Copy template'}
            </button>
          </div>
        }
      >
        {pendingStarterTemplateCopy ? (
          <div className="space-y-3 text-sm leading-6 text-[#4f435c]">
            <p>
              This creates a separate export draft from the curated starter. The original template and existing export
              definitions remain unchanged.
            </p>
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{pendingStarterTemplateCopy.title}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">{pendingStarterTemplateCopy.module}</span>
                <span className="status-pill-neutral">{pendingStarterTemplateCopy.exportType}</span>
                <span className="status-pill-neutral">{pendingStarterTemplateCopy.exportGroup}</span>
                <span className="status-pill-neutral">{pendingStarterTemplateCopy.defaultTags.length} starter tags</span>
              </div>
            </div>
          </div>
        ) : null}
      </RegModal>
      <RegModal
        open={Boolean(pendingReviewAction)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReviewAction(null);
          }
        }}
        title={pendingReviewCopy.title}
        description={pendingReviewCopy.description}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setPendingReviewAction(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={Boolean(pendingReviewCopy.busyKey && busyAction === pendingReviewCopy.busyKey)}
              onClick={() => void confirmReviewAction()}
              type="button"
            >
              {pendingReviewAction === 'duplicate' && <Copy className="mr-2 h-4 w-4" />}
              {pendingReviewAction === 'test-preview' && <Play className="mr-2 h-4 w-4" />}
              {pendingReviewAction === 'auto-map' && <WandSparkles className="mr-2 h-4 w-4" />}
              {pendingReviewAction === 'export-mappings' && <Download className="mr-2 h-4 w-4" />}
              {pendingReviewCopy.busyKey && busyAction === pendingReviewCopy.busyKey
                ? 'Working...'
                : pendingReviewCopy.confirmLabel}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm leading-6 text-[#4f435c]">
          <p>{pendingReviewCopy.body}</p>
          {draft ? (
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{draft.title}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">{draft.module}</span>
                <span className="status-pill-neutral">{draft.exportType}</span>
                <span className="status-pill-neutral">{draft.mappings.length} mappings</span>
                <span className="status-pill-neutral">{draft.filterRows.length} filters</span>
                <span className="status-pill-neutral">{draft.subTemplates.length} sub templates</span>
              </div>
              {pendingReviewAction === 'test-preview' && (
                <div className="mt-3 rounded-2xl border border-[#ded8e4] bg-white p-3 text-[#62576a]">
                  Preview scenario: <span className="font-medium text-[#241232]">{testScenarioName || 'Untitled preview'}</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </RegModal>
      <RegModal
        open={Boolean(pendingTemplateUpload)}
        onOpenChange={(open) => {
          if (!open) {
            dismissTemplateUploadReview();
          }
        }}
        title={
          pendingTemplateUpload?.mode === 'subtemplate-add'
            ? 'Add sub-template file'
            : pendingTemplateUpload?.mode === 'subtemplate-reanalyze'
              ? 'Re-analyze sub-template file'
              : 'Analyze export template'
        }
        description={
          pendingTemplateUpload
            ? `Review "${pendingTemplateUpload.file.name}" before sending it to the existing Export Builder analyzer.`
            : undefined
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={dismissTemplateUploadReview} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={
                !pendingTemplateUpload ||
                busyAction === 'analyze-template' ||
                busyAction === 'add-subtemplate' ||
                (pendingTemplateUpload.subTemplateId
                  ? busyAction === `subtemplate:${pendingTemplateUpload.subTemplateId}`
                  : false)
              }
              onClick={() => void confirmTemplateUploadReview()}
              type="button"
            >
              <Upload className="mr-2 h-4 w-4" />
              {pendingTemplateUpload?.mode === 'subtemplate-add'
                ? 'Add sub-template'
                : pendingTemplateUpload?.mode === 'subtemplate-reanalyze'
                  ? 'Re-analyze file'
                  : 'Analyze template'}
            </button>
          </div>
        }
      >
        {pendingTemplateUpload ? (
          <div className="space-y-4 text-sm leading-6 text-[#4f435c]">
            <p>
              The file is only processed after confirmation. The existing analyzer extracts placeholder tags and mapping
              suggestions without changing the saved export definition until you review and save the draft.
            </p>
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{pendingTemplateUpload.file.name}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">
                  {(pendingTemplateUpload.file.size / 1024).toFixed(1)} KB
                </span>
                <span className="status-pill-neutral">{pendingTemplateUpload.file.type || 'Template file'}</span>
                {pendingTemplateUpload.subTemplateTitle && (
                  <span className="status-pill-neutral">{pendingTemplateUpload.subTemplateTitle}</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
