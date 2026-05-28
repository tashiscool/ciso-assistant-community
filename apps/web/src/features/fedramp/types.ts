export type FedrampOverview = {
  offering: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    fedrampId: string | null;
    marketplaceUrl: string | null;
    serviceModel: string | null;
    deploymentModel: string | null;
    businessCategory: string | null;
    uei: string | null;
    contactEmail: string | null;
    supportEmail: string | null;
    trustCenterUrl: string | null;
    accessGuidance: string | null;
    availabilityStatus: string;
    nextOarDueOn: string | null;
    nextQuarterlyReviewOn: string | null;
    metadata: Record<string, unknown>;
  };
  trustCenter: {
    services: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      inScope: boolean;
      securityObjectives: string[];
      customerResponsibilities: string[];
      secureConfigurationSummary: string | null;
      tags: string[];
    }>;
    artifacts: Array<{
      id: string;
      artifactKind: string;
      title: string;
      versionLabel: string;
      summary: string | null;
      status: string;
      isPublic: boolean;
      audience: string;
      publishedAt: string;
      publicationState: string;
      generationSource: string;
      route: string | null;
      metadata: Record<string, unknown>;
    }>;
    grants: Array<{
      id: string;
      agencyName: string;
      contactName: string | null;
      contactEmail: string;
      grantType: string;
      status: string;
      tokenHint: string | null;
      issuedAt: string;
      expiresAt: string | null;
      lastAccessedAt: string | null;
      metadata: Record<string, unknown>;
    }>;
    accessSummary: {
      eventCount: number;
      latestEventAt: string | null;
    };
    publicManifestRoute: string;
  };
  communications: {
    contacts: Array<{
      id: string;
      agencyName: string;
      contactName: string;
      contactEmail: string;
      role: string;
      incidentEmail: string | null;
      notes: string | null;
    }>;
    messages: Array<{
      id: string;
      messageType: string;
      criticality: string;
      subject: string;
      status: string;
      dueAt: string | null;
      requiredActions: Array<Record<string, unknown>>;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
    deliveries: Array<{
      id: string;
      messageId: string;
      contactId: string | null;
      recipientEmail: string;
      deliveryStatus: string;
      escalationDueAt: string | null;
      acknowledgedAt: string | null;
      acknowledgedBy: string | null;
      confirmedAt: string | null;
      confirmedBy: string | null;
      confirmationMethod: string | null;
      deliveryLog: Record<string, unknown>;
    }>;
    incidents: Array<{
      id: string;
      incidentTitle: string;
      incidentState: string;
      reportedToFedrampAt: string | null;
      reportedToCisaAt: string | null;
      agencyNotifiedAt: string | null;
      finalReportDueAt: string | null;
      updateCadenceHours: number;
      fedrampReportStatus: string;
      cisaReportStatus: string;
      agencyReportStatus: string;
      summary: Record<string, unknown>;
    }>;
    summary: {
      contactCount: number;
      messageCount: number;
      incidentCount: number;
      overdueDeliveryCount: number;
    };
  };
  vdr: {
    evaluations: Array<{
      id: string;
      sourceType: string;
      sourceRecordId: string;
      sourceControlId: string | null;
      title: string;
      detectionSource: string;
      detectedAt: string;
      evaluatedAt: string;
      internetReachable: boolean;
      likelyExploitable: boolean;
      adverseImpact: string;
      acceptedVulnerability: boolean;
      acceptedReason: string | null;
      overdue: boolean;
      currentStatus: string;
      nextTargetDate: string | null;
      remediationSummary: string | null;
      details: Record<string, unknown>;
    }>;
    reports: Array<{
      id: string;
      reportMonth: string;
      title: string;
      status: string;
      publicationState: string;
      generationSource: string;
      artifactVersionId: string | null;
      publishedAt: string | null;
      summary: Record<string, unknown>;
    }>;
  };
  ccm: {
    cycles: Array<{
      id: string;
      cycleLabel: string;
      periodStart: string;
      periodEnd: string;
      nextReportDueOn: string;
      targetReviewOn: string | null;
      feedbackChannel: string | null;
      status: string;
      publicationState: string;
      generationSource: string;
      artifactVersionId: string | null;
      summary: Record<string, unknown>;
    }>;
    quarterlyReviews: Array<{
      id: string;
      oarCycleId: string | null;
      title: string;
      scheduledFor: string;
      registrationUrl: string | null;
      recordingUrl: string | null;
      transcriptUrl: string | null;
      status: string;
      publicationState: string;
      generationSource: string;
      summary: Record<string, unknown>;
    }>;
    feedbackItems: Array<{
      id: string;
      oarCycleId: string | null;
      quarterlyReviewId: string | null;
      submittedBy: string | null;
      submittedEmail: string | null;
      question: string;
      response: string | null;
      status: string;
      createdAt: string;
    }>;
  };
  scn: {
    changes: Array<{
      id: string;
      title: string;
      changeType: string;
      status: string;
      description: string;
      plannedStartOn: string | null;
      finishedOn: string | null;
      verifiedOn: string | null;
      verificationSummary: string | null;
      poamRefs: string[];
    }>;
    notices: Array<{
      id: string;
      significantChangeId: string;
      noticeKind: string;
      dueOn: string | null;
      sentAt: string | null;
      status: string;
      payload: Record<string, unknown>;
    }>;
  };
  secureConfig: {
    guides: Array<{
      id: string;
      title: string;
      summary: string | null;
      accessInstructions: string | null;
      currentSettings: Record<string, unknown>;
      machine: Record<string, unknown>;
      currentVsDefaultDiff: Array<{
        path: string;
        current: unknown;
        recommended: unknown;
      }>;
      artifactVersionId: string | null;
    }>;
    releases: Array<{
      id: string;
      guideId: string;
      versionLabel: string;
      defaults: Record<string, unknown>;
      releaseNotes: string | null;
      releasedAt: string;
    }>;
  };
  scope: {
    documents: Array<{
      id: string;
      title: string;
      status: string;
      narrativeMarkdown: string;
      metadata: Record<string, unknown>;
      artifactVersionId: string | null;
    }>;
    resourceFlows: Array<{
      id: string;
      scopeDocumentId: string;
      resourceName: string;
      resourceType: string;
      securityObjectives: string[];
      handlesFederalData: boolean;
      metadataInScope: boolean;
      flowSummary: string | null;
      upstreamResources: string[];
      downstreamResources: string[];
    }>;
    thirdPartyResources: Array<{
      id: string;
      scopeDocumentId: string;
      name: string;
      provider: string | null;
      usageSummary: string | null;
      justification: string | null;
      mitigations: string[];
      compensatingControls: string[];
    }>;
  };
  crypto: {
    inventory: Array<{
      id: string;
      serviceId: string | null;
      serviceName: string;
      moduleName: string;
      moduleVersion: string | null;
      cmvpCertificate: string | null;
      validationStatus: string;
      validationProvenance: string | null;
      updateStream: string | null;
      protectsFederalData: boolean;
      tenantDefaultEnabled: boolean;
      notes: string | null;
      artifactVersionId: string | null;
    }>;
  };
};
