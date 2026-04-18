import type { FrameworkControl, FrameworkTreeNode } from '../core/types';

export type LibraryDependency = {
  id: string;
  name: string;
};

export type LibraryThreat = {
  id: string;
  refId: string;
  name: string;
  description: string;
  severity: string;
};

export type LibraryRiskMatrix = {
  id: string;
  name: string;
  description: string;
  levels: Array<{
    label: string;
    score: number;
    tone: string;
  }>;
};

export type Library = {
  id: string;
  tenantId: string;
  frameworkId: string | null;
  frameworkName: string | null;
  frameworkKey: string | null;
  name: string;
  description: string | null;
  provider: string;
  packager: string;
  version: string | null;
  publicationDate: string | null;
  copyright: string | null;
  dependencies: LibraryDependency[];
  riskMatrices: LibraryRiskMatrix[];
  threats: LibraryThreat[];
  hasUpdate: boolean;
  objectsMeta: {
    frameworks: number;
    referenceControls: number;
    riskMatrices: number;
    threats: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type LibraryDetail = Library & {
  framework: {
    id: string;
    name: string | null;
    key: string | null;
  } | null;
  referenceControls: FrameworkControl[];
  tree: FrameworkTreeNode[];
};
