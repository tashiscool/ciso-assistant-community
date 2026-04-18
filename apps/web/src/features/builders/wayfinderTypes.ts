export type WayfinderStatus = 'Active' | 'Draft' | 'Archived';

export type WayfinderActivity = {
  id: string;
  title: string;
  type: string;
  description: string;
  link: string;
};

export type WayfinderStage = {
  id: string;
  name: string;
  description: string;
  activities: WayfinderActivity[];
};

export type WayfinderTemplateSummary = {
  id: string;
  title: string;
  status: WayfinderStatus;
  owner: string;
  creator: string;
  description: string | null;
  stageCount: number;
  activityCount: number;
  lastUpdated: string;
};

export type WayfinderTemplateDetail = {
  id: string;
  title: string;
  status: WayfinderStatus;
  owner: string;
  creator: string;
  description: string | null;
  stages: WayfinderStage[];
  createdAt: string;
  updatedAt: string;
};
