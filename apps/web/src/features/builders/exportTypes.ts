export type ExportStatus = 'Active' | 'Inactive';
export type ExportModule = string;
export type ExportType = 'DOCX' | 'XLSX';
export type RenderType =
  | 'Text'
  | 'RTF / HTML'
  | 'Date (MM/DD/YYYY)'
  | 'Date (YYYY-MM-DD)'
  | 'Date (MMMM d yyyy)'
  | 'Date Time'
  | 'UTC Date'
  | 'Relative Date'
  | 'Checkbox'
  | 'Checkbox YES/NO'
  | 'Boolean Yes/No'
  | 'Number'
  | 'Decimal'
  | 'File Name'
  | 'Image'
  | 'Multi Selection'
  | 'DataObject JSON'
  | 'DataObject Table';

export type TemplateAnalysis = {
  fileName: string;
  format: ExportType;
  tagsFound: number;
  mappedTags: number;
  unmappedTags: number;
  repeatedTags: number;
  tablesDetected: number;
  extractionMode: 'content-scan' | 'heuristic-seed';
  issues: string[];
};

export type MappingRow = {
  id: string;
  tag: string;
  fieldPath: string | null;
  fieldNodeId: string | null;
  renderType: RenderType;
  confidence: number;
  tableRegion: string;
  repeated: boolean;
  accepted: boolean;
};

export type FilterRow = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

export type SubTemplate = {
  id: string;
  title: string;
  fileName: string;
  status: string;
  analysis: TemplateAnalysis;
  mappings: MappingRow[];
};

export type FieldCatalogNode = {
  id: string;
  name: string;
  path?: string;
  helper?: string;
  fieldType?: string;
  children?: FieldCatalogNode[];
};

export type StarterTemplate = {
  id: string;
  title: string;
  module: ExportModule;
  exportGroup: string;
  exportType: ExportType;
  description: string;
  kind: 'system' | 'custom';
  defaultFileName: string;
  defaultTags: string[];
};

export type ExportBuilderSummary = {
  id: string;
  title: string;
  status: ExportStatus;
  module: ExportModule;
  exportGroup: string;
  exportType: ExportType;
  description: string | null;
  lastUpdated: string;
  mappings: number;
  tags: number;
  sourceKind: 'system' | 'custom';
};

export type ExportBuilderTestRun = {
  id: string;
  scenarioName: string;
  status: string;
  result: {
    mappedTags: number;
    unmappedTags: number;
    repeatedTags: number;
    filtersApplied: number;
    filterExpressionValid: boolean;
    filterDiagnostics: string[];
    subTemplates: number;
    renderTypes: string[];
    dataSources: string[];
    generationMode: string;
    masterAssessmentMode: boolean;
    previewLines: string[];
    generatedArtifactName: string;
  };
  createdByUserId: string | null;
  createdAt: string;
};

export type ExportBuilderDetail = {
  id: string;
  title: string;
  status: ExportStatus;
  module: ExportModule;
  exportGroup: string;
  exportType: ExportType;
  description: string | null;
  templateFileName: string | null;
  templateAnalysis: TemplateAnalysis;
  mappings: MappingRow[];
  filterRows: FilterRow[];
  filterExpression: string;
  subTemplates: SubTemplate[];
  sourceTemplateId: string | null;
  sourceKind: 'system' | 'custom';
  fieldCatalog: FieldCatalogNode[];
  starterTemplates: StarterTemplate[];
  testRuns: ExportBuilderTestRun[];
  createdAt: string;
  updatedAt: string;
};
