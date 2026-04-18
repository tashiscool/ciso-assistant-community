import type { EnvBindings } from './types/env';

export interface TransactionalEmailTemplate {
  subject: string;
  textBody: string;
  htmlBody: string;
}

export interface EmailSendResult {
  delivered: boolean;
  skipped: boolean;
  provider: string;
  providerStatus?: string;
  providerRequestId?: string;
  statusCode?: number;
  error?: string;
  errorCode?: string;
  errorDetail?: string;
}

type SendTransactionalEmailInput = {
  eventType: string;
  emailNormalized: string;
  userId?: string | null;
  dedupeKey?: string | null;
  template: TransactionalEmailTemplate;
  metadata?: Record<string, unknown> | null;
  errorCodePrefix?: string;
  webhookType?: string;
  webhookData?: Record<string, unknown>;
};

type MailConfig = {
  provider: string;
  fromEmail: string | null;
  fromName: string;
  timeoutMs: number;
  webhookUrl: string | null;
  webhookBearerToken: string | null;
  mailchannelsUrl: string;
  mailchannelsApiKey: string | null;
  dkimDomain: string | null;
  dkimSelector: string | null;
};

export type EmailRuntimeSummary = {
  provider: string;
  fromEmail: string | null;
  fromName: string;
  dkimDomain: string | null;
  dkimSelector: string | null;
  webhookConfigured: boolean;
  mailchannelsConfigured: boolean;
  providerSelected: boolean;
  sendingEnabled: boolean;
};

type LinkSpec = {
  label: string;
  url: string;
};

type BrandedTemplateInput = {
  subject: string;
  eyebrow?: string;
  title: string;
  introText: string;
  introHtml: string;
  bodyTextBlocks?: string[];
  bodyHtmlBlocks?: string[];
  primaryCta?: LinkSpec;
  secondaryLinks?: LinkSpec[];
  footerText?: string[];
  footerHtml?: string[];
};

function readEnvString(env: EnvBindings, name: string): string | null {
  const raw = (env as unknown as Record<string, unknown>)[name];
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProvider(value: string | null): string {
  return (value ?? 'none').trim().toLowerCase();
}

function readConfig(env: EnvBindings): MailConfig {
  return {
    provider: normalizeProvider(readEnvString(env, 'EMAIL_PROVIDER') ?? readEnvString(env, 'OTP_EMAIL_PROVIDER')),
    fromEmail: readEnvString(env, 'EMAIL_FROM') ?? readEnvString(env, 'OTP_EMAIL_FROM'),
    fromName: readEnvString(env, 'EMAIL_FROM_NAME') ?? readEnvString(env, 'OTP_EMAIL_FROM_NAME') ?? 'Regovise',
    timeoutMs:
      Math.max(
        1,
        Number.parseInt(
          readEnvString(env, 'EMAIL_TIMEOUT_SECONDS') ?? readEnvString(env, 'OTP_EMAIL_TIMEOUT_SECONDS') ?? '10',
          10,
        ) || 10,
      ) * 1000,
    webhookUrl: readEnvString(env, 'EMAIL_WEBHOOK_URL') ?? readEnvString(env, 'OTP_EMAIL_WEBHOOK_URL'),
    webhookBearerToken:
      readEnvString(env, 'EMAIL_WEBHOOK_BEARER_TOKEN') ?? readEnvString(env, 'OTP_EMAIL_WEBHOOK_BEARER_TOKEN'),
    mailchannelsUrl:
      readEnvString(env, 'EMAIL_MAILCHANNELS_URL') ??
      readEnvString(env, 'OTP_EMAIL_MAILCHANNELS_URL') ??
      'https://api.mailchannels.net/tx/v1/send',
    mailchannelsApiKey:
      readEnvString(env, 'EMAIL_MAILCHANNELS_API_KEY') ??
      readEnvString(env, 'OTP_EMAIL_MAILCHANNELS_API_KEY') ??
      readEnvString(env, 'MAILCHANNELS_API_KEY'),
    dkimDomain: readEnvString(env, 'EMAIL_DKIM_DOMAIN') ?? readEnvString(env, 'OTP_EMAIL_DKIM_DOMAIN'),
    dkimSelector: readEnvString(env, 'EMAIL_DKIM_SELECTOR') ?? readEnvString(env, 'OTP_EMAIL_DKIM_SELECTOR'),
  };
}

export function getEmailRuntimeSummary(env: EnvBindings): EmailRuntimeSummary {
  const config = readConfig(env);
  const webhookConfigured = Boolean(config.webhookUrl && config.webhookBearerToken);
  const mailchannelsConfigured = Boolean(config.mailchannelsApiKey && config.fromEmail);
  const providerSelected = config.provider !== 'none';
  const sendingEnabled =
    config.provider === 'mailchannels'
      ? mailchannelsConfigured
      : config.provider === 'webhook'
        ? webhookConfigured
        : false;
  return {
    provider: config.provider,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    dkimDomain: config.dkimDomain,
    dkimSelector: config.dkimSelector,
    webhookConfigured,
    mailchannelsConfigured,
    providerSelected,
    sendingEnabled,
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function nowMs(): number {
  return Date.now();
}

function truncateForStorage(value: string, maxLength = 240): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, Math.max(0, maxLength - 1)) + '…';
}

async function runWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function writeDeliveryLog(
  env: EnvBindings,
  input: SendTransactionalEmailInput,
  result: EmailSendResult,
): Promise<void> {
  try {
    await env.D1_MAIN.prepare(
      `INSERT INTO transactional_email_delivery_log(
         event_type,
         dedupe_key,
         user_id,
         email_normalized,
         subject,
         provider,
         delivery_status,
         provider_status_code,
         provider_response_status,
         provider_request_id,
         error_code,
         error_detail,
         metadata_json,
         created_at_ms
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        truncateForStorage(input.eventType.trim().toUpperCase(), 80),
        input.dedupeKey?.trim() ? truncateForStorage(input.dedupeKey.trim(), 180) : null,
        input.userId?.trim() ? truncateForStorage(input.userId.trim(), 120) : null,
        truncateForStorage(input.emailNormalized, 255),
        truncateForStorage(input.template.subject, 240),
        truncateForStorage(result.provider, 60),
        result.delivered ? 'sent' : result.skipped ? 'skipped' : 'failed',
        result.statusCode ?? null,
        result.providerStatus ? truncateForStorage(result.providerStatus, 80) : null,
        result.providerRequestId ? truncateForStorage(result.providerRequestId, 120) : null,
        result.errorCode ? truncateForStorage(result.errorCode, 120) : null,
        result.errorDetail ? truncateForStorage(result.errorDetail, 400) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        nowMs(),
      )
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'transactional_email_log_write_failed',
        eventType: input.eventType,
        userId: input.userId ?? null,
        provider: result.provider,
        message: error instanceof Error ? error.message : 'unknown_error',
      }),
    );
  }
}

async function hasRecentSuccessfulEmail(
  env: EnvBindings,
  dedupeKey: string,
  windowMs: number,
): Promise<boolean> {
  const normalizedKey = dedupeKey.trim();
  if (!normalizedKey) {
    return false;
  }
  const row = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS delivered_count
     FROM transactional_email_delivery_log
     WHERE dedupe_key = ?
       AND delivery_status = 'sent'
       AND created_at_ms >= ?`,
  )
    .bind(normalizedKey, nowMs() - Math.max(0, Math.floor(windowMs)))
    .first<{ delivered_count: number | null }>();
  return Number(row?.delivered_count ?? 0) > 0;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withFooter(
  baseOrigin: string,
  textBody: string,
  htmlBody: string,
  extraText: string[] = [],
  extraHtml: string[] = [],
): TransactionalEmailTemplate {
  const dashboardUrl = `${baseOrigin}/`;
  const settingsUrl = `${baseOrigin}/settings`;

  const textFooter = [
    ...extraText,
    '',
    `Open Regovise: ${dashboardUrl}`,
    `Settings: ${settingsUrl}`,
  ];

  const htmlFooter = [
    ...extraHtml,
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />',
    `<p style="margin:0;font-size:14px"><a href="${dashboardUrl}" style="color:#0f766e">Open Regovise</a> · <a href="${settingsUrl}" style="color:#0f766e">Settings</a></p>`,
  ];

  return {
    subject: '',
    textBody: [textBody.trim(), ...textFooter].join('\n'),
    htmlBody: [htmlBody, ...htmlFooter, '</div>'].join(''),
  };
}

export function buildBrandedEmailTemplate(
  input: BrandedTemplateInput & { baseOrigin: string },
): TransactionalEmailTemplate {
  const textParts = [input.title, '', input.introText.trim()];
  if (Array.isArray(input.bodyTextBlocks) && input.bodyTextBlocks.length > 0) {
    textParts.push('', ...input.bodyTextBlocks.map((entry) => entry.trim()).filter(Boolean));
  }
  if (input.primaryCta) {
    textParts.push('', `${input.primaryCta.label}: ${input.primaryCta.url}`);
  }
  if (Array.isArray(input.secondaryLinks) && input.secondaryLinks.length > 0) {
    textParts.push('', ...input.secondaryLinks.map((entry) => `${entry.label}: ${entry.url}`));
  }

  const htmlParts = [
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:24px;border:1px solid #cbd5e1">',
    input.eyebrow
      ? `<p style="margin:0 0 8px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${escapeHtml(input.eyebrow)}</p>`
      : '',
    `<h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#0f172a">${escapeHtml(input.title)}</h1>`,
    `<p style="margin:0 0 16px;font-size:16px;color:#334155">${input.introHtml}</p>`,
  ];

  if (Array.isArray(input.bodyHtmlBlocks) && input.bodyHtmlBlocks.length > 0) {
    htmlParts.push(...input.bodyHtmlBlocks);
  }
  if (input.primaryCta) {
    htmlParts.push(
      `<p style="margin:20px 0 0"><a href="${input.primaryCta.url}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px">${escapeHtml(input.primaryCta.label)}</a></p>`,
    );
  }
  if (Array.isArray(input.secondaryLinks) && input.secondaryLinks.length > 0) {
    htmlParts.push(
      `<p style="margin:14px 0 0;font-size:14px">${input.secondaryLinks
        .map((entry) => `<a href="${entry.url}" style="color:#0f766e">${escapeHtml(entry.label)}</a>`)
        .join(' · ')}</p>`,
    );
  }

  const withSharedFooter = withFooter(
    input.baseOrigin.replace(/\/+$/, ''),
    textParts.join('\n'),
    htmlParts.join(''),
    input.footerText ?? [],
    input.footerHtml ?? [],
  );

  return {
    subject: input.subject,
    textBody: withSharedFooter.textBody,
    htmlBody: withSharedFooter.htmlBody,
  };
}

export async function sendTransactionalEmail(
  env: EnvBindings,
  input: SendTransactionalEmailInput,
): Promise<EmailSendResult> {
  const dedupeKey = input.dedupeKey?.trim() ?? '';
  const errorPrefix = (input.errorCodePrefix?.trim() || 'email').replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
  if (dedupeKey) {
    const alreadySent = await hasRecentSuccessfulEmail(env, dedupeKey, 30 * 24 * 60 * 60 * 1000);
    if (alreadySent) {
      const result: EmailSendResult = {
        delivered: false,
        skipped: true,
        provider: 'dedupe',
        providerStatus: 'already_sent',
      };
      await writeDeliveryLog(env, input, result);
      return result;
    }
  }

  const config = readConfig(env);
  if (['none', 'off', 'disabled'].includes(config.provider)) {
    const result: EmailSendResult = {
      delivered: false,
      skipped: true,
      provider: config.provider || 'none',
      providerStatus: 'disabled',
    };
    await writeDeliveryLog(env, input, result);
    return result;
  }

  if (!config.fromEmail) {
    const result: EmailSendResult = {
      delivered: false,
      skipped: false,
      provider: config.provider,
      error: `${errorPrefix}_from_not_configured`,
      errorCode: `${errorPrefix}_from_not_configured`,
    };
    await writeDeliveryLog(env, input, result);
    return result;
  }

  if (config.provider === 'webhook') {
    if (!config.webhookUrl) {
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        error: `${errorPrefix}_webhook_url_not_configured`,
        errorCode: `${errorPrefix}_webhook_url_not_configured`,
      };
      await writeDeliveryLog(env, input, result);
      return result;
    }

    const webhookHeaders: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (config.webhookBearerToken) {
      webhookHeaders.authorization = `Bearer ${config.webhookBearerToken}`;
    }

    try {
      const response = await runWithTimeout(
        config.webhookUrl,
        {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            type: input.webhookType ?? input.eventType,
            recipient: {
              email: input.emailNormalized,
              userId: input.userId ?? null,
            },
            subject: input.template.subject,
            textBody: input.template.textBody,
            htmlBody: input.template.htmlBody,
            metadata: input.metadata ?? null,
            ...(input.webhookData ?? {}),
          }),
        },
        config.timeoutMs,
      );
      const responseText = await response.text().catch(() => '');

      if (!response.ok) {
        const detailSnippet = truncateForStorage(responseText, 180);
        const result: EmailSendResult = {
          delivered: false,
          skipped: false,
          provider: config.provider,
          statusCode: response.status,
          providerStatus: 'http_error',
          errorCode: `${errorPrefix}_webhook_delivery_failed`,
          errorDetail: detailSnippet,
          error: `${errorPrefix}_webhook_delivery_failed:${response.status}:${detailSnippet}`,
        };
        await writeDeliveryLog(env, input, result);
        return result;
      }

      const responseJson = safeJsonParse(responseText);
      const responseRecord = asObjectRecord(responseJson);
      const providerRequestId =
        typeof responseRecord?.requestId === 'string' && responseRecord.requestId.trim().length > 0
          ? truncateForStorage(responseRecord.requestId.trim(), 120)
          : typeof responseRecord?.request_id === 'string' && responseRecord.request_id.trim().length > 0
            ? truncateForStorage(responseRecord.request_id.trim(), 120)
            : undefined;

      const result: EmailSendResult = {
        delivered: true,
        skipped: false,
        provider: config.provider,
        statusCode: response.status,
        providerStatus: 'sent',
        providerRequestId,
      };
      await writeDeliveryLog(env, input, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        errorCode: `${errorPrefix}_webhook_delivery_error`,
        errorDetail: truncateForStorage(message, 180),
        error: `${errorPrefix}_webhook_delivery_error:${truncateForStorage(message, 180)}`,
      };
      await writeDeliveryLog(env, input, result);
      return result;
    }
  }

  if (config.provider === 'mailchannels') {
    if (!config.mailchannelsApiKey) {
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        error: `${errorPrefix}_mailchannels_api_key_not_configured`,
        errorCode: `${errorPrefix}_mailchannels_api_key_not_configured`,
      };
      await writeDeliveryLog(env, input, result);
      return result;
    }

    const personalization: Record<string, unknown> = {
      to: [{ email: input.emailNormalized }],
    };
    if (config.dkimDomain) {
      personalization.dkim_domain = config.dkimDomain;
    }
    if (config.dkimSelector) {
      personalization.dkim_selector = config.dkimSelector;
    }

    const mailPayload: Record<string, unknown> = {
      personalizations: [personalization],
      from: { email: config.fromEmail, name: config.fromName },
      subject: input.template.subject,
      content: [
        { type: 'text/plain', value: input.template.textBody },
        { type: 'text/html', value: input.template.htmlBody },
      ],
    };
    if (config.dkimDomain) {
      mailPayload.dkim_domain = config.dkimDomain;
    }
    if (config.dkimSelector) {
      mailPayload.dkim_selector = config.dkimSelector;
    }

    try {
      const response = await runWithTimeout(
        config.mailchannelsUrl,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Api-Key': config.mailchannelsApiKey,
          },
          body: JSON.stringify(mailPayload),
        },
        config.timeoutMs,
      );
      const responseText = await response.text().catch(() => '');
      const responseJson = safeJsonParse(responseText);
      const responseRecord = asObjectRecord(responseJson);
      const providerRequestId =
        typeof responseRecord?.request_id === 'string' && responseRecord.request_id.trim().length > 0
          ? truncateForStorage(responseRecord.request_id.trim(), 120)
          : undefined;
      const responseResults = Array.isArray(responseRecord?.results) ? responseRecord.results : [];
      const firstResult = responseResults.map((entry) => asObjectRecord(entry)).find(Boolean) ?? null;
      const providerResponseStatus =
        typeof firstResult?.status === 'string' && firstResult.status.trim().length > 0
          ? truncateForStorage(firstResult.status.trim().toLowerCase(), 60)
          : undefined;

      if (!response.ok) {
        const detailSnippet = truncateForStorage(responseText, 180);
        const result: EmailSendResult = {
          delivered: false,
          skipped: false,
          provider: config.provider,
          statusCode: response.status,
          providerStatus: providerResponseStatus ?? 'http_error',
          providerRequestId,
          errorCode: `${errorPrefix}_mailchannels_delivery_failed`,
          errorDetail: detailSnippet,
          error: `${errorPrefix}_mailchannels_delivery_failed:${response.status}:${detailSnippet}`,
        };
        await writeDeliveryLog(env, input, result);
        return result;
      }

      const failedResult = responseResults
        .map((entry) => asObjectRecord(entry))
        .find((entry) => String(entry?.status ?? '').toLowerCase() === 'failed');
      if (failedResult) {
        const reason =
          typeof failedResult.reason === 'string' && failedResult.reason.trim().length > 0
            ? failedResult.reason.trim()
            : 'mailchannels_rejected_message';
        const reasonSnippet = truncateForStorage(reason, 180);
        const result: EmailSendResult = {
          delivered: false,
          skipped: false,
          provider: config.provider,
          statusCode: response.status,
          providerStatus: 'failed',
          providerRequestId,
          errorCode: `${errorPrefix}_mailchannels_delivery_rejected`,
          errorDetail: reasonSnippet,
          error: `${errorPrefix}_mailchannels_delivery_rejected:${reasonSnippet}`,
        };
        await writeDeliveryLog(env, input, result);
        return result;
      }

      const result: EmailSendResult = {
        delivered: true,
        skipped: false,
        provider: config.provider,
        statusCode: response.status,
        providerStatus: providerResponseStatus ?? 'sent',
        providerRequestId,
      };
      await writeDeliveryLog(env, input, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        errorCode: `${errorPrefix}_mailchannels_delivery_error`,
        errorDetail: truncateForStorage(message, 180),
        error: `${errorPrefix}_mailchannels_delivery_error:${truncateForStorage(message, 180)}`,
      };
      await writeDeliveryLog(env, input, result);
      return result;
    }
  }

  const unsupported: EmailSendResult = {
    delivered: false,
    skipped: false,
    provider: config.provider,
    errorCode: `${errorPrefix}_provider_not_supported`,
    error: `${errorPrefix}_provider_not_supported`,
  };
  await writeDeliveryLog(env, input, unsupported);
  return unsupported;
}

export async function sendWorkspaceAccessProvisionedEmail(
  env: EnvBindings,
  input: {
    tenantId: string;
    userId: string;
    email: string;
    displayName: string;
    actorName: string;
    baseOrigin: string;
  },
): Promise<EmailSendResult> {
  const template = buildBrandedEmailTemplate({
    subject: 'Your Regovise workspace access is ready',
    eyebrow: 'Regovise Access',
    title: `Welcome to Regovise, ${input.displayName}`,
    introText: `${input.actorName} provisioned your access to the ${input.tenantId} workspace.`,
    introHtml: `<strong>${escapeHtml(input.actorName)}</strong> provisioned your access to the <strong>${escapeHtml(input.tenantId)}</strong> workspace.`,
    bodyTextBlocks: [
      'Use the workspace profile page to confirm your identity context and start working.',
    ],
    bodyHtmlBlocks: [
      '<p style="margin:0;color:#334155">Use the workspace profile page to confirm your identity context and start working.</p>',
    ],
    primaryCta: { label: 'Open workspace profile', url: `${input.baseOrigin.replace(/\/+$/, '')}/workspace/me` },
    secondaryLinks: [{ label: 'Open team administration', url: `${input.baseOrigin.replace(/\/+$/, '')}/workspace/team` }],
    baseOrigin: input.baseOrigin,
  });

  return sendTransactionalEmail(env, {
    eventType: 'workspace_access_provisioned',
    emailNormalized: input.email,
    userId: input.userId,
    dedupeKey: `workspace_access_provisioned:${input.userId}`,
    template,
    metadata: { tenantId: input.tenantId },
    errorCodePrefix: 'workspace_access',
  });
}

export async function sendLocalSignInCodeEmail(
  env: EnvBindings,
  input: {
    tenantId: string;
    userId: string;
    email: string;
    displayName: string;
    tenantName: string;
    code: string;
    expiresInMinutes: number;
    requestId: string;
    baseOrigin: string;
  },
): Promise<EmailSendResult> {
  const safeCode = escapeHtml(input.code);
  const template = buildBrandedEmailTemplate({
    subject: 'Your Regovise sign-in code',
    eyebrow: 'Regovise Sign-In',
    title: `Use ${input.code} to sign in`,
    introText: `A sign-in code was requested for ${input.tenantName}. Enter ${input.code} within ${input.expiresInMinutes} minutes to open a secure session.`,
    introHtml: `A sign-in code was requested for <strong>${escapeHtml(input.tenantName)}</strong>. Enter <strong style="font-size:18px;letter-spacing:0.24em">${safeCode}</strong> within <strong>${input.expiresInMinutes} minutes</strong> to open a secure session.`,
    bodyTextBlocks: [
      `Workspace member: ${input.displayName}`,
      'If you did not request this code, you can ignore this message and no access will be granted.',
    ],
    bodyHtmlBlocks: [
      `<p style="margin:0 0 8px;color:#334155">Workspace member: <strong>${escapeHtml(input.displayName)}</strong></p>`,
      '<p style="margin:0;color:#334155">If you did not request this code, you can ignore this message and no access will be granted.</p>',
    ],
    primaryCta: {
      label: 'Open Regovise',
      url: `${input.baseOrigin.replace(/\/+$/, '')}/`,
    },
    footerText: ['This sign-in code can only be used once.'],
    footerHtml: ['<p style="margin:0;color:#64748b">This sign-in code can only be used once.</p>'],
    baseOrigin: input.baseOrigin,
  });

  return sendTransactionalEmail(env, {
    eventType: 'local_sign_in_code',
    emailNormalized: input.email,
    userId: input.userId,
    dedupeKey: `local_sign_in_code:${input.requestId}`,
    template,
    metadata: {
      tenantId: input.tenantId,
      requestId: input.requestId,
      expiresInMinutes: input.expiresInMinutes,
    },
    errorCodePrefix: 'local_sign_in',
  });
}

export async function sendPortalAssignmentSubmittedEmail(
  env: EnvBindings,
  input: {
    tenantId: string;
    assignmentId: string;
    actorEmail: string;
    actorName: string;
    assignmentName: string;
    frameworkName?: string | null;
    baseOrigin: string;
  },
): Promise<EmailSendResult> {
  const template = buildBrandedEmailTemplate({
    subject: `Submission received for ${input.assignmentName}`,
    eyebrow: 'Regovise Portal',
    title: 'Your portal submission is in review',
    introText: `${input.assignmentName} was submitted successfully${input.frameworkName ? ` for ${input.frameworkName}` : ''}.`,
    introHtml: `<strong>${escapeHtml(input.assignmentName)}</strong> was submitted successfully${input.frameworkName ? ` for <strong>${escapeHtml(input.frameworkName)}</strong>` : ''}.`,
    bodyTextBlocks: [
      'Your responses are now available for reviewer follow-up.',
      `Assignment owner: ${input.actorName}`,
    ],
    bodyHtmlBlocks: [
      '<p style="margin:0 0 8px;color:#334155">Your responses are now available for reviewer follow-up.</p>',
      `<p style="margin:0;color:#334155">Assignment owner: <strong>${escapeHtml(input.actorName)}</strong></p>`,
    ],
    primaryCta: {
      label: 'Open assignment',
      url: `${input.baseOrigin.replace(/\/+$/, '')}/portal/assignments/${input.assignmentId}`,
    },
    baseOrigin: input.baseOrigin,
  });

  return sendTransactionalEmail(env, {
    eventType: 'portal_assignment_submitted',
    emailNormalized: input.actorEmail,
    dedupeKey: `portal_assignment_submitted:${input.assignmentId}`,
    template,
    metadata: { tenantId: input.tenantId, assignmentId: input.assignmentId },
    errorCodePrefix: 'portal_assignment',
  });
}

export async function sendReportExportReadyEmail(
  env: EnvBindings,
  input: {
    tenantId: string;
    exportId: string;
    recipientEmail: string;
    recipientName: string;
    exportName: string;
    format: string;
    status: string;
    baseOrigin: string;
  },
): Promise<EmailSendResult> {
  const template = buildBrandedEmailTemplate({
    subject: `${input.exportName} is ready`,
    eyebrow: 'Regovise Reports',
    title: 'Your export is ready',
    introText: `${input.exportName} finished with status ${input.status}.`,
    introHtml: `<strong>${escapeHtml(input.exportName)}</strong> finished with status <strong>${escapeHtml(input.status)}</strong>.`,
    bodyTextBlocks: [
      `Requested by: ${input.recipientName}`,
      `Format: ${input.format.toUpperCase()}`,
    ],
    bodyHtmlBlocks: [
      `<p style="margin:0 0 8px;color:#334155">Requested by: <strong>${escapeHtml(input.recipientName)}</strong></p>`,
      `<p style="margin:0;color:#334155">Format: <strong>${escapeHtml(input.format.toUpperCase())}</strong></p>`,
    ],
    primaryCta: {
      label: 'Download export',
      url: `${input.baseOrigin.replace(/\/+$/, '')}/_api/ops/reports/exports/${input.exportId}/download`,
    },
    secondaryLinks: [{ label: 'Open reports', url: `${input.baseOrigin.replace(/\/+$/, '')}/reports` }],
    baseOrigin: input.baseOrigin,
  });

  return sendTransactionalEmail(env, {
    eventType: 'report_export_ready',
    emailNormalized: input.recipientEmail,
    dedupeKey: `report_export_ready:${input.exportId}`,
    template,
    metadata: { tenantId: input.tenantId, exportId: input.exportId },
    errorCodePrefix: 'report_export',
  });
}
