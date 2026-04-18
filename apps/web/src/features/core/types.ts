export type Framework = {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  version: string | null;
  category: string | null;
  controlCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FrameworkControl = {
  id: string;
  tenantId: string;
  frameworkId: string;
  frameworkKey: string;
  frameworkName: string;
  ref: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrameworkTreeNode = {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  assessable: boolean;
  controlId: string | null;
  children: FrameworkTreeNode[];
};
