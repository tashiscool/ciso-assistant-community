import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import {
  acknowledgeFedrampDelivery,
  confirmFedrampDelivery,
  confirmIncidentAgencyNotifications,
  confirmIncidentCisaReport,
  confirmIncidentFedrampReport,
  createAgencyContact,
  createCryptoModuleInventoryRecord,
  createFeedbackItem,
  createFedrampMessage,
  createIncidentNotification,
  createScopeDocument,
  createSecureConfigGuide,
  createSecureDefaultRelease,
  createSignificantChange,
  createTrustCenterAccessGrant,
  createTrustCenterService,
  generateOarCycle,
  generateVdrReport,
  loadArtifactPayload,
  loadFedrampOverview,
  loadPortalTrustCenterView,
  loadPublicTrustCenterView,
  failFedrampDelivery,
  publishOarCycle,
  publishAssurancePackageToFedrampShell,
  publishQuarterlyReview,
  publishSignificantChangeNotice,
  publishVdrReport,
  queueFedrampMessage,
  queueIncidentNotification,
  requireFedrampAdmin,
  scheduleQuarterlyReview,
  seedFedrampBaselines,
  syncVulnerabilityEvaluations,
  updateFeedbackItem,
  updateSignificantChange,
  upsertTrustCenterOffering,
} from './runtime';

function queryValue(ctx: WorkerRequestContext, key: string) {
  return ctx.url.searchParams.get(key)?.trim() || null;
}

type VdrReportInput = NonNullable<Parameters<typeof generateVdrReport>[3]>;
type IncidentInput = Parameters<typeof createIncidentNotification>[3];

function asPublicationState(
  value: unknown,
): VdrReportInput['publicationState'] {
  return typeof value === 'string' &&
    ['working', 'published', 'superseded', 'withdrawn'].includes(value)
    ? (value as VdrReportInput['publicationState'])
    : undefined;
}

function asGenerationSource(
  value: unknown,
): VdrReportInput['generationSource'] {
  return typeof value === 'string' &&
    ['manual', 'package_publication', 'scheduled'].includes(value)
    ? (value as VdrReportInput['generationSource'])
    : undefined;
}

function asReportStatus(
  value: unknown,
): IncidentInput['fedrampReportStatus'] {
  return typeof value === 'string' && ['not_required', 'queued', 'confirmed', 'failed'].includes(value)
    ? (value as IncidentInput['fedrampReportStatus'])
    : undefined;
}

async function requireAdminOverview(ctx: WorkerRequestContext) {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }
  return loadFedrampOverview(ctx.env, access.tenantId, access.userId);
}

export async function handleTrustCenterRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const [resource, id] = segments;

  if (!resource) {
    if (ctx.request.method === 'GET') {
      const overview = await requireAdminOverview(ctx);
      return overview instanceof Response ? overview : json({ data: overview });
    }

    if (ctx.request.method === 'PUT') {
      const access = await requireFedrampAdmin(ctx);
      if (access instanceof Response) {
        return access;
      }
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const offering = await upsertTrustCenterOffering(ctx.env, access.tenantId, access.userId, {
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        name: typeof body.name === 'string' ? body.name : undefined,
        description: typeof body.description === 'string' ? body.description : body.description === null ? null : undefined,
        fedrampId: typeof body.fedrampId === 'string' ? body.fedrampId : body.fedrampId === null ? null : undefined,
        marketplaceUrl:
          typeof body.marketplaceUrl === 'string' ? body.marketplaceUrl : body.marketplaceUrl === null ? null : undefined,
        serviceModel: typeof body.serviceModel === 'string' ? body.serviceModel : body.serviceModel === null ? null : undefined,
        deploymentModel:
          typeof body.deploymentModel === 'string' ? body.deploymentModel : body.deploymentModel === null ? null : undefined,
        businessCategory:
          typeof body.businessCategory === 'string' ? body.businessCategory : body.businessCategory === null ? null : undefined,
        uei: typeof body.uei === 'string' ? body.uei : body.uei === null ? null : undefined,
        contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : body.contactEmail === null ? null : undefined,
        supportEmail: typeof body.supportEmail === 'string' ? body.supportEmail : body.supportEmail === null ? null : undefined,
        trustCenterUrl:
          typeof body.trustCenterUrl === 'string' ? body.trustCenterUrl : body.trustCenterUrl === null ? null : undefined,
        accessGuidance:
          typeof body.accessGuidance === 'string' ? body.accessGuidance : body.accessGuidance === null ? null : undefined,
        availabilityStatus:
          typeof body.availabilityStatus === 'string'
            ? body.availabilityStatus
            : body.availabilityStatus === null
              ? null
              : undefined,
        recentDisruptionSummary:
          typeof body.recentDisruptionSummary === 'string'
            ? body.recentDisruptionSummary
            : body.recentDisruptionSummary === null
              ? null
              : undefined,
        nextOarDueOn:
          typeof body.nextOarDueOn === 'string' ? body.nextOarDueOn : body.nextOarDueOn === null ? null : undefined,
        nextQuarterlyReviewOn:
          typeof body.nextQuarterlyReviewOn === 'string'
            ? body.nextQuarterlyReviewOn
            : body.nextQuarterlyReviewOn === null
              ? null
              : undefined,
        metadata:
          body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });
      return json({ data: offering });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'public') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const payload = await loadPublicTrustCenterView(ctx.env, {
      tenantId: ctx.tenantId,
      tenantSlug: queryValue(ctx, 'tenantSlug'),
    });
    return json({ data: payload });
  }

  if (resource === 'portal' && id) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const token = queryValue(ctx, 'token');
    if (!token) {
      return json({ error: 'missing_token', message: 'A trust-center portal token is required.' }, { status: 400 });
    }
    const payload = await loadPortalTrustCenterView(ctx.env, {
      grantId: id,
      token,
      requestPath: ctx.url.pathname,
      userAgent: ctx.request.headers.get('user-agent'),
    });
    return json({ data: payload });
  }

  if (resource === 'artifacts' && id) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const adminAccess = ctx.tenantId && ctx.userId ? await requireFedrampAdmin(ctx) : null;
    const payload = await loadArtifactPayload(ctx.env, {
      artifactId: id,
      tenantId: ctx.tenantId,
      isTenantAdmin: adminAccess ? !(adminAccess instanceof Response) : false,
      grantId: queryValue(ctx, 'grantId'),
      portalToken: queryValue(ctx, 'token'),
      requestPath: ctx.url.pathname,
      userAgent: ctx.request.headers.get('user-agent'),
    });
    return json({ data: payload });
  }

  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  if (resource === 'services') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.trustCenter.services });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const service = await createTrustCenterService(ctx.env, access.tenantId, access.userId, {
        name: typeof body.name === 'string' ? body.name : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        securityObjectives: Array.isArray(body.securityObjectives)
          ? body.securityObjectives.filter((item): item is string => typeof item === 'string')
          : undefined,
        customerResponsibilities: Array.isArray(body.customerResponsibilities)
          ? body.customerResponsibilities.filter((item): item is string => typeof item === 'string')
          : undefined,
        secureConfigurationSummary:
          typeof body.secureConfigurationSummary === 'string' ? body.secureConfigurationSummary : undefined,
        serviceSlug: typeof body.serviceSlug === 'string' ? body.serviceSlug : undefined,
        inScope: typeof body.inScope === 'boolean' ? body.inScope : undefined,
        tags: Array.isArray(body.tags) ? body.tags.filter((item): item is string => typeof item === 'string') : undefined,
      });
      await seedFedrampBaselines(ctx.env, access.tenantId, access.userId);
      return json({ data: service }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'grants') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.trustCenter.grants });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const grant = await createTrustCenterAccessGrant(ctx.env, access.tenantId, access.userId, {
        agencyName: typeof body.agencyName === 'string' ? body.agencyName : undefined,
        contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
        contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : undefined,
        grantType: typeof body.grantType === 'string' ? body.grantType : undefined,
        expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
        metadata:
          body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });
      return json({ data: grant }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'publish-package' && id) {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const publication = await publishAssurancePackageToFedrampShell(ctx.env, {
      tenantId: access.tenantId,
      userId: access.userId,
      packageJobId: id,
    });
    return json({ data: publication });
  }

  return json({ error: 'not_found', message: 'Trust center resource not found.' }, { status: 404 });
}

export async function handleFedrampCommunicationRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource, id, action] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.communications });
  }

  if (resource === 'contacts') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.communications.contacts });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const contact = await createAgencyContact(ctx.env, access.tenantId, access.userId, {
        agencyName: typeof body.agencyName === 'string' ? body.agencyName : undefined,
        contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
        contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : undefined,
        role: typeof body.role === 'string' ? body.role : undefined,
        incidentEmail: typeof body.incidentEmail === 'string' ? body.incidentEmail : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
      });
      return json({ data: contact }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'messages') {
    if (id && action === 'acknowledge') {
      if (ctx.request.method === 'POST') {
        const body = await readJson<Record<string, unknown>>(ctx.request);
        const delivery = await acknowledgeFedrampDelivery(ctx.env, access.tenantId, {
          deliveryId: typeof body.deliveryId === 'string' ? body.deliveryId : undefined,
          messageId: id,
          recipientEmail: typeof body.recipientEmail === 'string' ? body.recipientEmail : undefined,
          acknowledgedBy: typeof body.acknowledgedBy === 'string' ? body.acknowledgedBy : access.userId,
        });
        return json({ data: delivery });
      }
      return methodNotAllowed(['POST']);
    }
    if (id && action === 'queue') {
      if (ctx.request.method === 'POST') {
        const message = await queueFedrampMessage(ctx.env, access.tenantId, access.userId, id);
        return json({ data: message });
      }
      return methodNotAllowed(['POST']);
    }
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({
        data: {
          messages: overview.communications.messages,
          deliveries: overview.communications.deliveries,
        },
      });
    }
    if (ctx.request.method === 'POST' && !id) {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const message = await createFedrampMessage(ctx.env, access.tenantId, access.userId, {
        messageType: typeof body.messageType === 'string' ? body.messageType : undefined,
        criticality: typeof body.criticality === 'string' ? body.criticality : undefined,
        subject: typeof body.subject === 'string' ? body.subject : undefined,
        bodyMarkdown: typeof body.bodyMarkdown === 'string' ? body.bodyMarkdown : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        requiredActions: Array.isArray(body.requiredActions)
          ? body.requiredActions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
          : undefined,
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : undefined,
        metadata:
          body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : undefined,
        contactIds: Array.isArray(body.contactIds) ? body.contactIds.filter((item): item is string => typeof item === 'string') : undefined,
      });
      return json({ data: message }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'deliveries' && id) {
    if (action === 'confirm' && ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const delivery = await confirmFedrampDelivery(ctx.env, access.tenantId, {
        deliveryId: id,
        confirmedBy: typeof body.confirmedBy === 'string' ? body.confirmedBy : access.userId,
        confirmationMethod: typeof body.confirmationMethod === 'string' ? body.confirmationMethod : 'manual_confirmation',
      });
      return json({ data: delivery });
    }
    if (action === 'fail' && ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const delivery = await failFedrampDelivery(ctx.env, access.tenantId, {
        deliveryId: id,
        confirmedBy: typeof body.confirmedBy === 'string' ? body.confirmedBy : access.userId,
        confirmationMethod: typeof body.confirmationMethod === 'string' ? body.confirmationMethod : 'manual_failure',
        failureReason: typeof body.failureReason === 'string' ? body.failureReason : undefined,
      });
      return json({ data: delivery });
    }
    return methodNotAllowed(['POST']);
  }

  if (resource === 'incidents') {
    if (id && action === 'queue') {
      if (ctx.request.method === 'POST') {
        const incident = await queueIncidentNotification(ctx.env, access.tenantId, id);
        return json({ data: incident });
      }
      return methodNotAllowed(['POST']);
    }
    if (id && action === 'confirm-fedramp') {
      if (ctx.request.method === 'POST') {
        const incident = await confirmIncidentFedrampReport(ctx.env, access.tenantId, id);
        return json({ data: incident });
      }
      return methodNotAllowed(['POST']);
    }
    if (id && action === 'confirm-cisa') {
      if (ctx.request.method === 'POST') {
        const incident = await confirmIncidentCisaReport(ctx.env, access.tenantId, id);
        return json({ data: incident });
      }
      return methodNotAllowed(['POST']);
    }
    if (id && action === 'confirm-agencies') {
      if (ctx.request.method === 'POST') {
        const incident = await confirmIncidentAgencyNotifications(ctx.env, access.tenantId, id);
        return json({ data: incident });
      }
      return methodNotAllowed(['POST']);
    }
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.communications.incidents });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const incident = await createIncidentNotification(ctx.env, access.tenantId, access.userId, {
        incidentTitle: typeof body.incidentTitle === 'string' ? body.incidentTitle : undefined,
        incidentState: typeof body.incidentState === 'string' ? body.incidentState : undefined,
        reportedToFedrampAt: typeof body.reportedToFedrampAt === 'string' ? body.reportedToFedrampAt : undefined,
        reportedToCisaAt: typeof body.reportedToCisaAt === 'string' ? body.reportedToCisaAt : undefined,
        agencyNotifiedAt: typeof body.agencyNotifiedAt === 'string' ? body.agencyNotifiedAt : undefined,
        finalReportDueAt: typeof body.finalReportDueAt === 'string' ? body.finalReportDueAt : undefined,
        updateCadenceHours: typeof body.updateCadenceHours === 'number' ? body.updateCadenceHours : undefined,
        fedrampReportStatus: asReportStatus(body.fedrampReportStatus),
        cisaReportStatus: asReportStatus(body.cisaReportStatus),
        agencyReportStatus: asReportStatus(body.agencyReportStatus),
        summary:
          body.summary && typeof body.summary === 'object' && !Array.isArray(body.summary)
            ? (body.summary as Record<string, unknown>)
            : undefined,
      });
      return json({ data: incident }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', message: 'FedRAMP communications resource not found.' }, { status: 404 });
}

export async function handleVdrRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource, id, action] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.vdr });
  }

  if (resource === 'sync') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const result = await syncVulnerabilityEvaluations(ctx.env, access.tenantId, access.userId);
    return json({ data: result });
  }

  if (resource === 'reports') {
    if (id && action === 'publish') {
      if (ctx.request.method === 'POST') {
        const report = await publishVdrReport(ctx.env, access.tenantId, id);
        return json({ data: report });
      }
      return methodNotAllowed(['POST']);
    }
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.vdr.reports });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const report = await generateVdrReport(ctx.env, access.tenantId, access.userId, {
        reportMonth: typeof body.reportMonth === 'string' ? body.reportMonth : undefined,
        publicationState: asPublicationState(body.publicationState),
        generationSource: asGenerationSource(body.generationSource),
      });
      return json({ data: report }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', message: 'VDR resource not found.' }, { status: 404 });
}

export async function handleCcmRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource, id, action] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.ccm });
  }

  if (resource === 'oar-cycles') {
    if (id && action === 'publish') {
      if (ctx.request.method === 'POST') {
        const cycle = await publishOarCycle(ctx.env, access.tenantId, id);
        return json({ data: cycle });
      }
      return methodNotAllowed(['POST']);
    }
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.ccm.cycles });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const cycle = await generateOarCycle(ctx.env, access.tenantId, access.userId, {
        cycleLabel: typeof body.cycleLabel === 'string' ? body.cycleLabel : undefined,
        periodStart: typeof body.periodStart === 'string' ? body.periodStart : undefined,
        periodEnd: typeof body.periodEnd === 'string' ? body.periodEnd : undefined,
        nextReportDueOn: typeof body.nextReportDueOn === 'string' ? body.nextReportDueOn : undefined,
        targetReviewOn: typeof body.targetReviewOn === 'string' ? body.targetReviewOn : undefined,
        feedbackChannel: typeof body.feedbackChannel === 'string' ? body.feedbackChannel : undefined,
        publicationState: asPublicationState(body.publicationState),
        generationSource: asGenerationSource(body.generationSource),
      });
      return json({ data: cycle }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'feedback') {
    if (id && ctx.request.method === 'PATCH') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const feedback = await updateFeedbackItem(ctx.env, access.tenantId, id, {
        response: typeof body.response === 'string' ? body.response : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
      });
      return json({ data: feedback });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const feedback = await createFeedbackItem(ctx.env, access.tenantId, {
        oarCycleId: typeof body.oarCycleId === 'string' ? body.oarCycleId : undefined,
        quarterlyReviewId: typeof body.quarterlyReviewId === 'string' ? body.quarterlyReviewId : undefined,
        submittedBy: typeof body.submittedBy === 'string' ? body.submittedBy : undefined,
        submittedEmail: typeof body.submittedEmail === 'string' ? body.submittedEmail : undefined,
        question: typeof body.question === 'string' ? body.question : undefined,
        response: typeof body.response === 'string' ? body.response : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        isAnonymized: typeof body.isAnonymized === 'boolean' ? body.isAnonymized : undefined,
      });
      return json({ data: feedback }, { status: 201 });
    }
    return methodNotAllowed(['POST', 'PATCH']);
  }

  if (resource === 'quarterly-reviews') {
    if (id && action === 'publish') {
      if (ctx.request.method === 'POST') {
        const review = await publishQuarterlyReview(ctx.env, access.tenantId, id);
        return json({ data: review });
      }
      return methodNotAllowed(['POST']);
    }
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.ccm.quarterlyReviews });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const review = await scheduleQuarterlyReview(ctx.env, access.tenantId, access.userId, {
        oarCycleId: typeof body.oarCycleId === 'string' ? body.oarCycleId : undefined,
        title: typeof body.title === 'string' ? body.title : undefined,
        scheduledFor: typeof body.scheduledFor === 'string' ? body.scheduledFor : undefined,
        registrationUrl: typeof body.registrationUrl === 'string' ? body.registrationUrl : undefined,
        recordingUrl: typeof body.recordingUrl === 'string' ? body.recordingUrl : undefined,
        transcriptUrl: typeof body.transcriptUrl === 'string' ? body.transcriptUrl : undefined,
        publicationState: asPublicationState(body.publicationState),
        generationSource: asGenerationSource(body.generationSource),
        summary:
          body.summary && typeof body.summary === 'object' && !Array.isArray(body.summary)
            ? (body.summary as Record<string, unknown>)
            : undefined,
      });
      return json({ data: review }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', message: 'CCM resource not found.' }, { status: 404 });
}

export async function handleScnRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource, id, action] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.scn });
  }

  if (resource === 'changes') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.scn });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const change = await createSignificantChange(ctx.env, access.tenantId, access.userId, {
        title: typeof body.title === 'string' ? body.title : undefined,
        changeType: typeof body.changeType === 'string' ? body.changeType : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        customerImpact: typeof body.customerImpact === 'string' ? body.customerImpact : undefined,
        planTimeline: typeof body.planTimeline === 'string' ? body.planTimeline : undefined,
        impactAnalysis: typeof body.impactAnalysis === 'string' ? body.impactAnalysis : undefined,
        approverName: typeof body.approverName === 'string' ? body.approverName : undefined,
        approverTitle: typeof body.approverTitle === 'string' ? body.approverTitle : undefined,
        plannedStartOn: typeof body.plannedStartOn === 'string' ? body.plannedStartOn : undefined,
        finishedOn: typeof body.finishedOn === 'string' ? body.finishedOn : undefined,
        verifiedOn: typeof body.verifiedOn === 'string' ? body.verifiedOn : undefined,
        verificationSummary: typeof body.verificationSummary === 'string' ? body.verificationSummary : undefined,
        poamRefs: Array.isArray(body.poamRefs) ? body.poamRefs.filter((item): item is string => typeof item === 'string') : undefined,
      });
      return json({ data: change }, { status: 201 });
    }
    if (id && ctx.request.method === 'PATCH') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const change = await updateSignificantChange(ctx.env, access.tenantId, access.userId, id, {
        title: typeof body.title === 'string' ? body.title : undefined,
        changeType: typeof body.changeType === 'string' ? body.changeType : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        customerImpact: typeof body.customerImpact === 'string' ? body.customerImpact : undefined,
        planTimeline: typeof body.planTimeline === 'string' ? body.planTimeline : undefined,
        impactAnalysis: typeof body.impactAnalysis === 'string' ? body.impactAnalysis : undefined,
        approverName: typeof body.approverName === 'string' ? body.approverName : undefined,
        approverTitle: typeof body.approverTitle === 'string' ? body.approverTitle : undefined,
        plannedStartOn: typeof body.plannedStartOn === 'string' ? body.plannedStartOn : undefined,
        finishedOn: typeof body.finishedOn === 'string' ? body.finishedOn : undefined,
        verifiedOn: typeof body.verifiedOn === 'string' ? body.verifiedOn : undefined,
        verificationSummary: typeof body.verificationSummary === 'string' ? body.verificationSummary : undefined,
        poamRefs: Array.isArray(body.poamRefs) ? body.poamRefs.filter((item): item is string => typeof item === 'string') : undefined,
      });
      return json({ data: change });
    }
    return methodNotAllowed(['GET', 'POST', 'PATCH']);
  }

  if (resource === 'notices' && id && action === 'publish') {
    if (ctx.request.method === 'POST') {
      const notice = await publishSignificantChangeNotice(ctx.env, access.tenantId, access.userId, id);
      return json({ data: notice });
    }
    return methodNotAllowed(['POST']);
  }

  return json({ error: 'not_found', message: 'SCN resource not found.' }, { status: 404 });
}

export async function handleSecureConfigRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.secureConfig });
  }

  if (resource === 'guides') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.secureConfig.guides });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const guide = await createSecureConfigGuide(ctx.env, access.tenantId, access.userId, {
        title: typeof body.title === 'string' ? body.title : undefined,
        summary: typeof body.summary === 'string' ? body.summary : undefined,
        guideMarkdown: typeof body.guideMarkdown === 'string' ? body.guideMarkdown : undefined,
        machine:
          body.machine && typeof body.machine === 'object' && !Array.isArray(body.machine)
            ? (body.machine as Record<string, unknown>)
            : undefined,
        accessInstructions: typeof body.accessInstructions === 'string' ? body.accessInstructions : undefined,
        currentSettings:
          body.currentSettings && typeof body.currentSettings === 'object' && !Array.isArray(body.currentSettings)
            ? (body.currentSettings as Record<string, unknown>)
            : undefined,
      });
      return json({ data: guide }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'releases') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.secureConfig.releases });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const release = await createSecureDefaultRelease(ctx.env, access.tenantId, access.userId, {
        guideId: typeof body.guideId === 'string' ? body.guideId : undefined,
        versionLabel: typeof body.versionLabel === 'string' ? body.versionLabel : undefined,
        defaults:
          body.defaults && typeof body.defaults === 'object' && !Array.isArray(body.defaults)
            ? (body.defaults as Record<string, unknown>)
            : undefined,
        releaseNotes: typeof body.releaseNotes === 'string' ? body.releaseNotes : undefined,
      });
      return json({ data: release }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', message: 'Secure-config resource not found.' }, { status: 404 });
}

export async function handleScopeRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.scope });
  }

  if (resource === 'documents') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.scope });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const document = await createScopeDocument(ctx.env, access.tenantId, access.userId, {
        title: typeof body.title === 'string' ? body.title : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        narrativeMarkdown: typeof body.narrativeMarkdown === 'string' ? body.narrativeMarkdown : undefined,
        metadata:
          body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : undefined,
        resourceFlows: Array.isArray(body.resourceFlows)
          ? body.resourceFlows
              .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
              .map((item) => ({
                resourceName: typeof item.resourceName === 'string' ? item.resourceName : 'Resource',
                resourceType: typeof item.resourceType === 'string' ? item.resourceType : 'application',
                securityObjectives: Array.isArray(item.securityObjectives)
                  ? item.securityObjectives.filter((entry): entry is string => typeof entry === 'string')
                  : undefined,
                handlesFederalData: typeof item.handlesFederalData === 'boolean' ? item.handlesFederalData : undefined,
                metadataInScope: typeof item.metadataInScope === 'boolean' ? item.metadataInScope : undefined,
                flowSummary: typeof item.flowSummary === 'string' ? item.flowSummary : undefined,
                upstreamResources: Array.isArray(item.upstreamResources)
                  ? item.upstreamResources.filter((entry): entry is string => typeof entry === 'string')
                  : undefined,
                downstreamResources: Array.isArray(item.downstreamResources)
                  ? item.downstreamResources.filter((entry): entry is string => typeof entry === 'string')
                  : undefined,
              }))
          : undefined,
        thirdPartyResources: Array.isArray(body.thirdPartyResources)
          ? body.thirdPartyResources
              .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
              .map((item) => ({
                name: typeof item.name === 'string' ? item.name : 'Third-party resource',
                provider: typeof item.provider === 'string' ? item.provider : undefined,
                usageSummary: typeof item.usageSummary === 'string' ? item.usageSummary : undefined,
                justification: typeof item.justification === 'string' ? item.justification : undefined,
                mitigations: Array.isArray(item.mitigations)
                  ? item.mitigations.filter((entry): entry is string => typeof entry === 'string')
                  : undefined,
                compensatingControls: Array.isArray(item.compensatingControls)
                  ? item.compensatingControls.filter((entry): entry is string => typeof entry === 'string')
                  : undefined,
              }))
          : undefined,
      });
      return json({ data: document }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', message: 'Scope resource not found.' }, { status: 404 });
}

export async function handleCryptoRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const access = await requireFedrampAdmin(ctx);
  if (access instanceof Response) {
    return access;
  }

  const [resource] = segments;
  if (!resource) {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
    return json({ data: overview.crypto });
  }

  if (resource === 'inventory') {
    if (ctx.request.method === 'GET') {
      const overview = await loadFedrampOverview(ctx.env, access.tenantId, access.userId);
      return json({ data: overview.crypto.inventory });
    }
    if (ctx.request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const item = await createCryptoModuleInventoryRecord(ctx.env, access.tenantId, access.userId, {
        serviceId: typeof body.serviceId === 'string' ? body.serviceId : undefined,
        serviceName: typeof body.serviceName === 'string' ? body.serviceName : undefined,
        moduleName: typeof body.moduleName === 'string' ? body.moduleName : undefined,
        moduleVersion: typeof body.moduleVersion === 'string' ? body.moduleVersion : undefined,
        cmvpCertificate: typeof body.cmvpCertificate === 'string' ? body.cmvpCertificate : undefined,
        validationStatus: typeof body.validationStatus === 'string' ? body.validationStatus : undefined,
        validationProvenance: typeof body.validationProvenance === 'string' ? body.validationProvenance : undefined,
        updateStream: typeof body.updateStream === 'string' ? body.updateStream : undefined,
        protectsFederalData: typeof body.protectsFederalData === 'boolean' ? body.protectsFederalData : undefined,
        tenantDefaultEnabled: typeof body.tenantDefaultEnabled === 'boolean' ? body.tenantDefaultEnabled : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
      });
      return json({ data: item }, { status: 201 });
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', message: 'Crypto resource not found.' }, { status: 404 });
}
