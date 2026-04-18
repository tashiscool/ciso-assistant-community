export type DashboardAccess = 'Public' | 'Private';
export type DashboardItemType = 'Widget' | 'Report';
export type PaletteTab = 'Widgets' | 'Reports' | 'By Module';

export type DashboardTemplateItem = {
  templateId: string;
  title: string;
  type: DashboardItemType;
  tab: PaletteTab;
  description: string;
  sourceLabel: string;
  defaultColumn: 'left' | 'right';
};

export type DashboardLayoutItem = DashboardTemplateItem & {
  instanceId: string;
  column: 'left' | 'right';
};

export type DashboardSummary = {
  id: string;
  title: string;
  access: DashboardAccess;
  groups: string[];
  favorite: boolean;
  published: boolean;
  lastUpdated: string;
  itemCount: number;
};

export type DashboardDetail = {
  id: string;
  title: string;
  access: DashboardAccess;
  groups: string[];
  favorite: boolean;
  published: boolean;
  items: DashboardLayoutItem[];
  layout: {
    left: string[];
    right: string[];
  };
  availableItems: DashboardTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

export type DashboardLibraryResponse = {
  dashboards: DashboardSummary[];
  availableItems: DashboardTemplateItem[];
};
