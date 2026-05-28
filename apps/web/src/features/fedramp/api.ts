import { ApiClient } from '../../shared/api/client';
import type { FedrampOverview } from './types';

const client = new ApiClient();

export async function getFedrampOverview() {
  const response = await client.get<{ data: FedrampOverview }>('/trust-center');
  return response.data;
}

export async function updateFedrampOffering(body: Record<string, unknown>) {
  const response = await client.put<{ data: FedrampOverview['offering'] }>('/trust-center', body);
  return response.data;
}

export async function createTrustCenterService(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/trust-center/services', body);
  return response.data;
}

export async function createTrustCenterGrant(body: Record<string, unknown>) {
  const response = await client.post<{
    data: {
      grant: unknown;
      portalToken: string;
      portalPath: string;
    };
  }>('/trust-center/grants', body);
  return response.data;
}

export async function createAgencyContact(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/fedramp-communications/contacts', body);
  return response.data;
}

export async function createFedrampMessage(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/fedramp-communications/messages', body);
  return response.data;
}

export async function queueFedrampMessage(messageId: string) {
  const response = await client.post<{ data: unknown }>(`/fedramp-communications/messages/${encodeURIComponent(messageId)}/queue`);
  return response.data;
}

export async function confirmFedrampDelivery(deliveryId: string, body: Record<string, unknown> = {}) {
  const response = await client.post<{ data: unknown }>(
    `/fedramp-communications/deliveries/${encodeURIComponent(deliveryId)}/confirm`,
    body,
  );
  return response.data;
}

export async function failFedrampDelivery(deliveryId: string, body: Record<string, unknown> = {}) {
  const response = await client.post<{ data: unknown }>(
    `/fedramp-communications/deliveries/${encodeURIComponent(deliveryId)}/fail`,
    body,
  );
  return response.data;
}

export async function createIncidentNotification(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/fedramp-communications/incidents', body);
  return response.data;
}

export async function queueIncidentNotification(incidentId: string) {
  const response = await client.post<{ data: unknown }>(`/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/queue`);
  return response.data;
}

export async function confirmIncidentFedramp(incidentId: string) {
  const response = await client.post<{ data: unknown }>(`/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/confirm-fedramp`);
  return response.data;
}

export async function confirmIncidentCisa(incidentId: string) {
  const response = await client.post<{ data: unknown }>(`/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/confirm-cisa`);
  return response.data;
}

export async function confirmIncidentAgencies(incidentId: string) {
  const response = await client.post<{ data: unknown }>(`/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/confirm-agencies`);
  return response.data;
}

export async function syncVdrEvaluations() {
  const response = await client.post<{ data: { syncedCount: number } }>('/vdr/sync', {});
  return response.data;
}

export async function generateVdrReport(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/vdr/reports', body);
  return response.data;
}

export async function publishVdrReport(reportId: string) {
  const response = await client.post<{ data: unknown }>(`/vdr/reports/${encodeURIComponent(reportId)}/publish`);
  return response.data;
}

export async function generateOarCycle(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/ccm/oar-cycles', body);
  return response.data;
}

export async function publishOarCycle(cycleId: string) {
  const response = await client.post<{ data: unknown }>(`/ccm/oar-cycles/${encodeURIComponent(cycleId)}/publish`);
  return response.data;
}

export async function scheduleQuarterlyReview(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/ccm/quarterly-reviews', body);
  return response.data;
}

export async function publishQuarterlyReview(reviewId: string) {
  const response = await client.post<{ data: unknown }>(`/ccm/quarterly-reviews/${encodeURIComponent(reviewId)}/publish`);
  return response.data;
}

export async function createFeedbackItem(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/ccm/feedback', body);
  return response.data;
}

export async function updateFeedbackItem(feedbackId: string, body: Record<string, unknown>) {
  const response = await client.patch<{ data: unknown }>(`/ccm/feedback/${encodeURIComponent(feedbackId)}`, body);
  return response.data;
}

export async function createSignificantChange(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/scn/changes', body);
  return response.data;
}

export async function updateSignificantChange(changeId: string, body: Record<string, unknown>) {
  const response = await client.patch<{ data: unknown }>(`/scn/changes/${encodeURIComponent(changeId)}`, body);
  return response.data;
}

export async function publishSignificantChangeNotice(noticeId: string) {
  const response = await client.post<{ data: unknown }>(`/scn/notices/${encodeURIComponent(noticeId)}/publish`);
  return response.data;
}

export async function createSecureGuide(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/secure-config/guides', body);
  return response.data;
}

export async function createSecureRelease(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/secure-config/releases', body);
  return response.data;
}

export async function createScopeDocument(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/scope/documents', body);
  return response.data;
}

export async function createCryptoInventory(body: Record<string, unknown>) {
  const response = await client.post<{ data: unknown }>('/crypto/inventory', body);
  return response.data;
}
