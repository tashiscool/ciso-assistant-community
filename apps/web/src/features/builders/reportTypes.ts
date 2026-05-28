export type ReportChartType = 'List' | 'Bar' | 'Line' | 'Pie';
export type ReportStatus = 'Active' | 'Draft';
export type RecurrenceType = 'Daily' | 'Weekly' | 'Monthly';

export type ReportFilterRow = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

export type ReportConfig = {
  reportTitle: string;
  chartType: ReportChartType;
  module: string;
  groupBy: string;
  aggregateField: string;
  aggregationType: 'Count' | 'Sum' | 'Average';
  selectedFields: string[];
  displayFields: string[];
  drillDownFields: string[];
  sortingFields: string[];
  filterLogic: string;
  filters: ReportFilterRow[];
};

export type ReportBuilderSummary = {
  id: string;
  title: string;
  chartType: ReportChartType;
  module: string;
  owner: string;
  status: ReportStatus;
  source: 'Report Builder';
  description: string | null;
  lastUpdated: string;
};

export type ReportSubscription = {
  id: string;
  recipientEmail: string;
  recipientType: string;
  startDate: string;
  recurrenceType: RecurrenceType;
  lastSentAt: string | null;
  createdAt: string;
};

export type ReportBuilderDetail = {
  id: string;
  title: string;
  chartType: ReportChartType;
  module: string;
  owner: string;
  status: ReportStatus;
  source: 'Report Builder';
  description: string | null;
  config: ReportConfig;
  subscriptions: ReportSubscription[];
  createdAt: string;
  updatedAt: string;
};

export type ReportPreview =
  | {
      kind: 'table';
      columns: string[];
      rows: string[][];
      recordCount?: number;
      filterExpressionValid?: boolean;
    }
  | {
      kind: 'series';
      labels: string[];
      values: number[];
      recordCount?: number;
      filterExpressionValid?: boolean;
    };

export type ReportLibraryResponse = {
  reports: ReportBuilderSummary[];
  modules: string[];
  displayFields: string[];
};
