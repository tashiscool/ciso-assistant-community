import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLoopbackBaseUrl } from '../../apps/web/scripts/responsive_qa_policy.mjs';

// A browser fixture for a runner-owned local database, never a public/ordinary development target.
export async function createQuestionnaireFixture(readyFile) {
  const ready = JSON.parse(await fs.readFile(readyFile, 'utf8'));
  const origin = assertLoopbackBaseUrl(ready.baseUrl);
  async function request(route, body, method = 'POST') {
    const response = await fetch(`${origin}${route}`, { method, redirect: 'manual', signal: AbortSignal.timeout(30_000), headers: { 'content-type': 'application/json', 'x-tenant-id': 'tenant-demo', 'x-user-id': 'user-demo' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.headers.get('x-regovise-verification-run') !== ready.runId) throw new Error('Target is not this runner-owned local Worker. No further fixture operations will run.');
    if (!response.ok) throw new Error(`Local questionnaire fixture operation failed (${response.status}).`);
    return response.json();
  }
  // Verify ownership before any write.
  await request('/_api/core/health', undefined, 'GET');
  const created = await request('/_api/builders/questionnaires', { name: 'Synthetic access review', description: 'Local browser test fixture', allowPublicUrl: true, loginRequired: false });
  const templateId = created.data.template.id;
  await request(`/_api/builders/questionnaires/${templateId}`, { name: 'Synthetic access review', status: 'published', allowPublicUrl: true, loginRequired: false, questions: [{ id: 'fixture-access-owner', ref: 'FIXTURE-1', prompt: 'Who reviewed access for this synthetic system?', type: 'text', section: 'Access review', required: true, weight: 1 }] }, 'PUT');
  const assignment = await request(`/_api/builders/questionnaires/${templateId}/assignments`, { title: 'Synthetic system access review', assignmentType: 'email', assigneeEmail: 'reviewer@example.test', loginRequired: false });
  const instance = assignment.data.instances[0];
  const result = { mode: 'synthetic-owned-local-browser-fixture', runId: ready.runId, baseUrl: origin, templateId, instanceId: instance.id, url: `${origin}/questionnaires/response/${instance.shareToken}`, accessCode: instance.accessCode };
  await fs.writeFile(path.join(path.dirname(readyFile), 'questionnaire-fixture.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const readyFile = process.argv[2];
  if (!readyFile) throw new Error('Pass the ready.json file from an active isolated --serve run.');
  console.log(JSON.stringify(await createQuestionnaireFixture(path.resolve(readyFile))));
}
