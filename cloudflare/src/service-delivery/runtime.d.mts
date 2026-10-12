export interface ServiceIdentity { tenantId: string; actorId: string; roles: string[]; }
export interface ServiceEnvironment {
  DB?: unknown;
  BLOB?: unknown;
  PRODUCT_COMMANDS?: unknown;
  PRODUCT_COORDINATOR?: unknown;
  SERVICE_DELIVERY_ENABLED?: string;
  SERVICE_ALLOWED_ORIGINS?: string;
  SERVICE_DONATION_STRIPE_KEY?: string;
  SERVICE_DONATION_WEBHOOK_SECRET?: string;
  SERVICE_DONATION_RETURN_URL?: string;
}
export function handleServiceGateway(request: Request, env: ServiceEnvironment, appId: string, identity?: ServiceIdentity): Promise<Response | null>;
export function runServiceSweep(env: ServiceEnvironment, appId: string): Promise<void>;
export function processServiceMessage(env: ServiceEnvironment, appId: string, body: unknown, queueName?: string): Promise<boolean>;
export function consumeServiceBatch<T extends { queue?: string; messages: readonly {body: unknown; ack?(): void; retry?(): void}[] }>(env: ServiceEnvironment, appId: string, batch: T): Promise<T>;
export function serviceJson(body: unknown, status?: number): Response;
export function serviceContract(appId: string): { app_id: string; outcome: string; completion_evidence: string; funding: Record<string, unknown> } | null;
export class DonationServiceCoordinator {
  constructor(state: unknown);
  fetch(request: Request): Promise<Response>;
}
