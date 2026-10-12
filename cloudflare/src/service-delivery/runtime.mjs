// Generated from platform-core/shared by build-domain-service-runtime.mjs. Do not edit.

// shared/jwt.ts
var MAX_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;
var MAX_ROLE_COUNT = 64;
var MAX_ENTITLEMENT_COUNT = 256;
var MAX_AUTHORIZATION_ENTRY_LENGTH = 256;
var UNSAFE_AUTHORIZATION_ENTRY_CHARACTER = /[,\u0000-\u001F\u007F-\u009F]/;
function hasCanonicalEntries(values, maxEntryLength) {
  return new Set(values).size === values.length && values.every(
    (value) => typeof value === "string" && value !== "" && value.length <= maxEntryLength && value.trim() === value && value.normalize("NFC") === value && !UNSAFE_AUTHORIZATION_ENTRY_CHARACTER.test(value)
  );
}
function toArrayBuffer(input) {
  const copy = new Uint8Array(input.length);
  copy.set(input);
  return copy.buffer;
}
function fromBase64Url(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function textDecode(input) {
  return new TextDecoder().decode(input);
}
function textEncode(input) {
  return new TextEncoder().encode(input);
}
async function importPublicKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}
function decodeJwtWithoutVerification(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(textDecode(fromBase64Url(parts[0])));
    const claims = JSON.parse(textDecode(fromBase64Url(parts[1])));
    return { header, claims };
  } catch {
    return null;
  }
}
async function verifyJwt(token, options) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const parsed = decodeJwtWithoutVerification(token);
  if (!parsed) return null;
  if (parsed.header.typ !== "JWT" || parsed.header.alg !== "RS256" || !parsed.header.kid) return null;
  const jwk = await options.resolvePublicJwk(parsed.header.kid, parsed.header.alg);
  if (!jwk) return null;
  const publicKey = await importPublicKey(jwk);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    toArrayBuffer(fromBase64Url(sig)),
    toArrayBuffer(textEncode(`${head}.${body}`))
  );
  if (!verified) return null;
  const now2 = Math.floor(Date.now() / 1e3);
  const leeway = options.leewaySeconds ?? 30;
  const claims = parsed.claims;
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
  if (claims.iss !== options.expectedIssuer) return null;
  if (options.expectedAudience && claims.aud !== options.expectedAudience) return null;
  if (typeof claims.sub !== "string" || claims.sub.trim() === "") return null;
  if (claims.org_id !== null && (typeof claims.org_id !== "string" || claims.org_id.trim() === "")) return null;
  if (!Array.isArray(claims.roles) || !Array.isArray(claims.entitlements)) return null;
  if (claims.roles.length > MAX_ROLE_COUNT || claims.entitlements.length > MAX_ENTITLEMENT_COUNT) return null;
  if (!hasCanonicalEntries(claims.roles, MAX_AUTHORIZATION_ENTRY_LENGTH) || !hasCanonicalEntries(claims.entitlements, MAX_AUTHORIZATION_ENTRY_LENGTH)) return null;
  if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)) return null;
  if (claims.exp <= claims.iat) return null;
  if (claims.exp - claims.iat > MAX_TOKEN_LIFETIME_SECONDS) return null;
  if (claims.exp <= now2 - leeway) return null;
  if (claims.iat > now2 + leeway) return null;
  return claims;
}

// shared/utils.ts
var DEFAULT_CORS_ALLOW_HEADERS = [
  "authorization",
  "content-type",
  "x-access-token",
  "x-actor-id",
  "idempotency-key",
  "x-idempotency-key",
  "x-tenant-id",
  "x-user-role",
  "x-role",
  "x-entitlements",
  "x-requested-with"
].join(", ");
var DEFAULT_CORS_ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
var DEFAULT_CORS_EXPOSE_HEADERS = "content-type, content-length, content-disposition, location";
var corsAllowedOrigins;
function corsHeaders(request) {
  let allowOrigin = "*";
  if (corsAllowedOrigins !== void 0) {
    const origin = request?.headers.get("origin") || null;
    if (corsAllowedOrigins.includes("*")) {
      allowOrigin = "*";
    } else if (origin && corsAllowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else {
      allowOrigin = null;
    }
  }
  if (allowOrigin === null) return {};
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": DEFAULT_CORS_ALLOW_METHODS,
    "access-control-allow-headers": request?.headers.get("access-control-request-headers") || DEFAULT_CORS_ALLOW_HEADERS,
    "access-control-expose-headers": DEFAULT_CORS_EXPOSE_HEADERS,
    "access-control-max-age": "86400",
    ...allowOrigin !== "*" ? { vary: "origin" } : {}
  };
}
function json(data, status = 200, request) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json; charset=utf-8"
    }
  });
}
function badRequest(message) {
  return json({ error: message }, 400);
}
function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}
async function readJson(request) {
  return await request.json();
}

// shared/product-auth.ts
var JWKS_CACHE_TTL_MS = 5 * 60 * 1e3;
var jwksCache = /* @__PURE__ */ new Map();
function resolveAuthMode(env) {
  const configured = (env.AUTH_ENFORCEMENT || "").toLowerCase();
  if (configured === "verified") return "verified";
  if (configured === "legacy") return "legacy";
  if (env.AUTH_JWKS || env.AUTH_JWKS_URL) return "verified";
  return "legacy";
}
function extractBearerToken(request) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return request.headers.get("x-access-token") || null;
}
async function loadJwks(env) {
  if (env.AUTH_JWKS) {
    try {
      return JSON.parse(env.AUTH_JWKS);
    } catch {
      return null;
    }
  }
  if (env.AUTH_JWKS_URL) {
    const cached = jwksCache.get(env.AUTH_JWKS_URL);
    if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) return cached.document;
    const response = await fetch(env.AUTH_JWKS_URL);
    if (!response.ok) return cached?.document ?? null;
    const document = await response.json();
    jwksCache.set(env.AUTH_JWKS_URL, { fetchedAt: Date.now(), document });
    return document;
  }
  return null;
}
async function verifyRequestToken(token, env) {
  if (!env.AUTH_ISSUER) return null;
  return verifyJwt(token, {
    expectedIssuer: env.AUTH_ISSUER,
    expectedAudience: env.AUTH_AUDIENCE || null,
    resolvePublicJwk: async (kid) => {
      const jwks = await loadJwks(env);
      if (!jwks?.keys) return null;
      return jwks.keys.find((key) => key.kid === kid) ?? null;
    }
  });
}
function tenantFromClaims(claims) {
  return claims.org_id || "default";
}
function isPlatformAdmin(claims) {
  return Array.isArray(claims.roles) && claims.roles.includes("platform_admin");
}
async function authenticateRequest(request, env, options) {
  const mode = resolveAuthMode(env);
  const headerTenant = request.headers.get("x-tenant-id");
  if (mode === "legacy") {
    if (options.requireToken && !extractBearerToken(request)) {
      return unauthorized("Bearer token required");
    }
    return { mode, tenantId: headerTenant || "default", claims: null };
  }
  if (!env.AUTH_ISSUER || !env.AUTH_JWKS && !env.AUTH_JWKS_URL) {
    return json(
      {
        error: "auth_misconfigured",
        message: "AUTH_ENFORCEMENT=verified requires AUTH_ISSUER and AUTH_JWKS or AUTH_JWKS_URL."
      },
      500
    );
  }
  const token = extractBearerToken(request);
  if (!token) {
    if (!options.requireToken) return { mode, tenantId: headerTenant || "default", claims: null };
    return unauthorized("Bearer token required");
  }
  const claims = await verifyRequestToken(token, env);
  if (!claims) return unauthorized("Invalid or expired token");
  const claimTenant = tenantFromClaims(claims);
  let tenantId = claimTenant;
  if (headerTenant && headerTenant !== claimTenant) {
    if (!isPlatformAdmin(claims)) {
      return unauthorized("Tenant mismatch between token and x-tenant-id header");
    }
    tenantId = headerTenant;
  }
  return { mode, tenantId, claims };
}

// shared/service-contracts.ts
var SERVICE_FUNDING_POLICY = {
  model: "voluntary_donations",
  payment_required: false,
  donation_affects_eligibility: false,
  donation_affects_priority: false,
  donor_access_to_cases: false,
  third_party_costs: "disclosed_separately_and_approved",
  tax_deductibility: "not_represented",
  market_admission: "existing_free_alternative_boundary_applies"
};
var outcomes = {
  "001": ["Restore or establish authorized account access.", "Verified access or recovery receipt."],
  "002": ["Qualify a lead and carry the agreed sales follow-up through its recorded disposition.", "Contact history and reviewed opportunity disposition."],
  "003": ["Reconcile a period of books and identify unresolved discrepancies.", "Reviewed reconciliation and financial reports."],
  "004": ["Coordinate a team decision and assigned follow-up.", "Decision record and acknowledged task assignments."],
  "005": ["Deliver an agreed project milestone with acceptance review.", "Deliverables, test evidence and owner acceptance."],
  "006": ["Investigate a support request and follow it through resolution.", "Response history and requester confirmation."],
  "007": ["Prepare a document and coordinate authorized signatures.", "Final document and recipient signature audit."],
  "008": ["Organize a document collection for secure retrieval and sharing.", "Inventory, access review and verified export."],
  "009": ["Prepare and deliver an approved email communication.", "Approved content and provider delivery receipt."],
  "010": ["Coordinate a consented care-team meeting within CivicCareOS.", "Attendance, consent and approved visit artifacts."],
  "011": ["Run an approved outreach experiment and report observed results.", "Campaign approval and measured experiment report."],
  "012": ["Answer an operational question with a reproducible analysis.", "Source references, query and reviewed results."],
  "013": ["Investigate an operational alert and track corrective action.", "Incident timeline and recovery verification."],
  "014": ["Assess controls against evidence and prepare remediation for Regovise.", "Reviewed assessment and assigned remediation package."],
  "015": ["Triage a security finding and coordinate an approved response.", "Evidence, response approval and verification record."],
  "016": ["Execute an approved repeatable workflow with exception handling.", "Step receipts and reviewed execution result."],
  "017": ["Organize operational records into a usable shared data workspace.", "Validated schema, import results and access review."],
  "018": ["Build and review a repository change within Forge/Kiln.", "Reviewed changes, passing checks and approved deployment receipt."],
  "019": ["Reconcile an operational business process across inventory and accounts.", "Reviewed transaction records and exception report."],
  "020": ["Prepare a reproducible dataset from approved sources.", "Source lineage, transformation results and validation report."],
  "021": ["Prepare and publish approved editorial content.", "Editorial approval and publication receipt."],
  "022": ["Collect an agreed set of responses and deliver a usable result.", "Validated responses and reviewed export."],
  "023": ["Arrange an appointment acceptable to its participants.", "Participant approval and booking confirmation."],
  "024": ["Organize and publish an approved knowledge collection or book.", "Reviewed edition and publication verification."],
  "025": ["Help a user securely organize or recover access to their vault.", "User-authorized operation receipt without plaintext secrets."],
  "026": ["Monitor a service and coordinate incident updates.", "Check history, notification receipts and incident resolution."],
  "027": ["Publish a verified destination link and report its use.", "Destination review, redirect verification and aggregate analytics."],
  "028": ["Prepare a design deliverable for owner review and handoff.", "Versioned design, review decisions and export."],
  "029": ["Reconcile equipment custody and outstanding returns.", "Inventory audit and acknowledged custody receipts."],
  "030": ["Prepare invoices and reconcile their recorded payments.", "Approved invoice, delivery receipt and reconciliation."],
  "031": ["Resolve a supported inquiry or route it to a responsible person.", "Source-grounded answer or acknowledged escalation."],
  "032": ["Prepare and publish approved social communications.", "Content approval and platform publication receipts."],
  "033": ["Guide a learner through an agreed learning objective.", "Completed activities and assessed learning evidence."],
  "034": ["Assemble a controlled evidence package for a compliance review.", "Evidence provenance, access review and reviewer decision."],
  "035": ["Explain a public expenditure using traceable records.", "Source-linked expenditure reconciliation."],
  "036": ["Reconcile personal finances and prepare a reviewed spending plan.", "Reconciliation and user-approved budget."],
  "037": ["Deliver an organized reading feed from chosen sources.", "Source provenance and delivered digest."],
  "038": ["Compare housing options against the household requirements.", "Sourced comparison and user-selected next steps."],
  "039": ["Prepare a location-specific weather briefing.", "Timestamped forecasts, sources and alert delivery."],
  "040": ["Carry an agreed task plan through completion or escalation.", "Task evidence and owner acceptance."],
  "041": ["Organize a mailbox and propose actions for user approval.", "Approved actions and mailbox change receipts."],
  "042": ["Prepare a travel comparison against stated constraints.", "Current quote sources and reviewed itinerary."],
  "043": ["Explain food information relevant to the user requirements.", "Source-linked ingredient and nutrition review."],
  "044": ["Review recurring subscriptions and assist with approved changes.", "Reviewed subscription list and provider confirmation."],
  "045": ["Prepare a practical meal plan and shopping list.", "Reviewed recipes, servings and consolidated list."],
  "046": ["Organize a personal health record for a consented care review.", "Source records and acknowledged care-team handoff."],
  "047": ["Reconcile calendar conflicts and propose an approved schedule.", "Participant approval and calendar update receipts."],
  "048": ["Support consented introductions and protected conversations.", "Mutual consent, communication access and safety follow-up."],
  "049": ["Capture and organize material for later retrieval.", "Source snapshot, metadata and searchable collection."],
  "050": ["Coordinate an agreed group activity.", "Participant decisions and confirmed arrangements."],
  "051": ["Prepare and track authorized personal-data removal requests.", "Submission receipts and provider responses."],
  "052": ["Find a relevant public service and prepare the next action.", "Current official source and completed application or referral handoff."],
  "053": ["Document a suspected reduction in product value.", "Comparable dated product evidence and reviewed finding."],
  "054": ["Refer a renter to an existing accessible landlord-review service.", "Referral to a maintained free alternative; no competing standalone launch."],
  "055": ["Coordinate an agreed care plan and responsible care-team actions.", "Consent, assigned actions and acknowledged handoff."],
  "056": ["Prepare a usable transit journey with accessibility constraints.", "Current service information and reviewed route."],
  "057": ["Prepare a document package for appropriate legal review.", "Source evidence and authorized reviewer disposition."],
  "058": ["Help a family review safety settings and reported concerns.", "Guardian-authorized actions and follow-up record."],
  "059": ["Match an assistance request to available support.", "Eligibility context and recipient or provider confirmation."],
  "060": ["Organize important records for controlled recovery or handoff.", "Verified inventory, access review and recovery evidence."],
  "061": ["Explain a recurring bill and investigate discrepancies.", "Line-item comparison and provider response."],
  "062": ["Compare a purchase against current alternatives.", "Dated comparable offers and reviewed recommendation."],
  "063": ["Prepare a reviewed tax return and supported filing or export handoff.", "Tax-year validation, taxpayer approval and filing receipt or export."],
  "064": ["Publish or access an authorized media experience.", "Rights approval, playable media and delivery verification."],
  "065": ["Coordinate a clinician-approved rehabilitation plan.", "Clinical approval, adherence records and measured follow-up."],
  "066": ["Organize animal-care records and a provider handoff.", "Owner consent and provider acknowledgment."],
  "067": ["Assess a stated environmental question using traceable evidence.", "Method, source data and reviewed assessment."],
  "068": ["Coordinate a neighborhood request with accountable participants.", "Accepted assignments and requester follow-up."],
  "069": ["Track a chosen price and notify the user of a relevant change.", "Dated price evidence and notification receipt."],
  "070": ["Prepare a repair request and coordinate its approved completion.", "Approved quote and repair acceptance."],
  "071": ["Help a learner work through a chosen study objective.", "Reviewed exercises and learner progress evidence."],
  "072": ["Prepare a grant application for applicant review.", "Eligibility sources, reviewed application and submission receipt."],
  "073": ["Compare borrowing terms and explain total costs.", "Dated offers, calculation evidence and user acknowledgment."],
  "074": ["Explain local air-quality observations and relevant alerts.", "Timestamped measurements and alert delivery."],
  "075": ["Coordinate an approved meal order or food-support handoff.", "Fulfillment receipt and separately reconciled cook and delivery costs."],
  "076": ["Compare route conditions against the user requirements.", "Current source evidence and reviewed route options."],
  "077": ["Arrange a mutually agreed exchange of skills.", "Participant agreement and completion confirmations."],
  "078": ["Organize a plant-care assessment and follow-up.", "Observation record, sourced guidance and follow-up."],
  "079": ["Explain available water-quality evidence.", "Dated test sources and reviewed explanation."],
  "080": ["Prepare a sustainable household spending plan.", "Reconciled inputs and user-approved actions."],
  "081": ["Find accessibility information for a planned visit.", "Dated accessibility evidence and venue confirmation where available."],
  "082": ["Arrange a tool loan and track its return.", "Approved reservation and custody receipts."],
  "083": ["Review energy use and prepare prioritized improvements.", "Source bills, calculation method and reviewed recommendations."],
  "084": ["Follow a civic concern through the responsible public process.", "Official references, action receipt and tracked response."],
  "085": ["Compare shipment options and reconcile an approved delivery.", "Approved quote, custody evidence and delivery receipt."],
  "086": ["Compare medication access options for appropriate review.", "Dated price and benefit sources and provider handoff."],
  "087": ["Prepare and track an authorized public-records request.", "Submission receipt, deadline history and agency response."],
  "088": ["Explain a medical bill and prepare a reviewed dispute or care handoff.", "Source-linked explanation, approved packet and handoff receipt."],
  "089": ["Prepare a truthful application package for a reviewed job listing.", "Verified experience, listing evidence and jobseeker approval."],
  "090": ["Prepare an insurance appeal and track authorized follow-up.", "Reviewed appeal, authorized submission receipt and payer response."],
  "091": ["Screen relevant benefits and assist with an approved application.", "Current rule sources, application receipt and agency decision."],
  "092": ["Guide an authorized identity-protection or recovery action.", "Bureau confirmation and user-reviewed recovery checklist."],
  "093": ["Prepare a consumer dispute and track the authorized response.", "Reviewed evidence, submission receipt and counterparty response."],
  "094": ["Organize a workplace-rights concern for appropriate review.", "Evidence packet, worker approval and agency or adviser handoff."],
  "095": ["Prepare a tenant-rights request and track its response.", "Dated evidence, tenant approval and delivery receipt."],
  "096": ["Reconcile an education support plan with delivered services.", "Family-reviewed service evidence and school response."],
  "097": ["Organize personal knowledge for controlled retrieval and sharing.", "Verified collection, search and consented export."],
  "098": ["Arrange an approved meal-prep booking and reconcile fulfillment.", "Booking acceptance, receipts and separately reconciled provider payout."],
  "099": ["Carry a resident request through an accountable service handoff.", "Resident approval, provider acknowledgment and resident follow-up."],
  "100": ["Arrange a reviewed stay and reconcile its approved charges.", "Booking confirmation, stay record and supplier reconciliation."]
};
function serviceContract(appId) {
  if (!/^app-\d{3}$/.test(appId)) return null;
  const entry = outcomes[appId.replace(/^app-/, "")];
  if (!entry) return null;
  return {
    app_id: appId,
    outcome: entry[0],
    completion_evidence: entry[1],
    funding: SERVICE_FUNDING_POLICY,
    lifecycle: ["submitted", "in_progress", "prepared", "approved", "handed_off", "resolved", "cancelled", "failed"],
    approvals: ["beneficiary_approves_exact_prepared_artifact", "operator_records_handoff_evidence", "beneficiary_confirms_resolution"],
    external_outcome_guaranteed: false
  };
}

// shared/service-delivery.ts
var ServiceError = class extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
};
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var id = () => crypto.randomUUID();
var serviceJson = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
async function serviceHash(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, "0")).join("");
}
function dbFor(env) {
  const db = env.DB ?? env.PRODUCT_DB;
  if (!db) throw new ServiceError(503, "service_database_unavailable");
  return db;
}
function blobFor(env) {
  const blob = env.BLOB ?? env.PRODUCT_BLOB;
  if (!blob) throw new ServiceError(503, "service_artifacts_unavailable");
  return blob;
}
function text(value, name, max = 300) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ServiceError(400, `invalid_${name}`);
  return value.trim();
}
async function serviceRawBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError(400, "body_required");
  let size = 0;
  const chunks = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new ServiceError(413, "body_too_large");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
async function serviceBody(request) {
  let result;
  try {
    result = JSON.parse(await serviceRawBody(request));
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(400, "invalid_json");
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new ServiceError(400, "object_required");
  return result;
}
function only(body, fields) {
  if (Object.keys(body).some((key) => !fields.includes(key))) throw new ServiceError(400, "unsupported_field");
}
function isOperator(identity) {
  return identity.roles.some((role) => ["service_operator", "platform_admin"].includes(role));
}
function requireOperator(identity) {
  if (!isOperator(identity)) throw new ServiceError(403, "service_operator_required");
}
function ownerOnly(row, identity) {
  if (row.owner_id !== identity.actorId) throw new ServiceError(403, "beneficiary_approval_required");
}
async function loadCase(db, appId, identity, caseId) {
  const row = await db.prepare("SELECT * FROM service_cases WHERE id = ? AND app_id = ? AND tenant_id = ?").bind(caseId, appId, identity.tenantId).first();
  if (!row || row.owner_id !== identity.actorId && !isOperator(identity)) throw new ServiceError(404, "case_not_found");
  return row;
}
function visibleCase(row) {
  const { input_hash, request_json, ...rest } = row;
  return { ...rest, request: JSON.parse(request_json) };
}
async function locked(env, scope, fn) {
  if (!env.PRODUCT_COORDINATOR) throw new ServiceError(503, "service_coordinator_unavailable");
  const scopeId = `service:${await serviceHash(scope)}`;
  const stub = env.PRODUCT_COORDINATOR.get(env.PRODUCT_COORDINATOR.idFromName(scopeId));
  const ownerId = id();
  const payload = { lock_id: "mutation", owner_id: ownerId, ttl_seconds: 60 };
  const response = await stub.fetch(`https://coordinator/locks/acquire?scope=${scopeId}`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" }
  });
  if (!response.ok || !(await response.json()).acquired) throw new ServiceError(409, "service_busy_retry");
  try {
    return await fn();
  } finally {
    await stub.fetch(`https://coordinator/locks/release?scope=${scopeId}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" }
    }).catch(() => void 0);
  }
}
async function transition(db, row, actor, action, status, fields = {}, extra = []) {
  const eventId = id();
  const at = now();
  try {
    await db.batch([
      db.prepare("INSERT INTO service_case_events (id, case_id, version, actor_id, action, artifact_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(eventId, row.id, row.version + 1, actor, action, fields.prepared ?? fields.approved ?? fields.handoff ?? null, at),
      db.prepare(`UPDATE service_cases SET status = ?, version = version + 1,
        prepared_artifact_id = COALESCE(?, prepared_artifact_id), approved_artifact_id = COALESCE(?, approved_artifact_id),
        handoff_artifact_id = COALESCE(?, handoff_artifact_id), assigned_to = COALESCE(?, assigned_to),
        follow_up_at = COALESCE(?, follow_up_at), updated_at = ? WHERE id = ? AND version = ?`).bind(
        status,
        fields.prepared ?? null,
        fields.approved ?? null,
        fields.handoff ?? null,
        fields.assigned ?? null,
        fields.followup ?? null,
        at,
        row.id,
        row.version
      ),
      ...extra
    ]);
  } catch (error) {
    if (/UNIQUE constraint failed: service_case_events/.test(String(error))) throw new ServiceError(409, "case_version_conflict");
    throw error;
  }
}
async function artifact(env, row, kind, actorId, content) {
  const artifactId = id();
  const serialized = JSON.stringify(content);
  const digest = await serviceHash(serialized);
  const key = `${row.app_id}/services/${await serviceHash(row.tenant_id)}/${row.id}/${artifactId}.json`;
  await blobFor(env).put(key, serialized, { httpMetadata: { contentType: "application/json" }, customMetadata: { sha256: digest } });
  const statement = dbFor(env).prepare(`INSERT INTO service_artifacts
    (id, case_id, kind, object_key, sha256, byte_length, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(artifactId, row.id, kind, key, digest, new TextEncoder().encode(serialized).byteLength, actorId, now());
  return { artifactId, key, statement };
}
async function checkedArtifact(env, row, artifactId) {
  const item = await dbFor(env).prepare("SELECT * FROM service_artifacts WHERE id = ? AND case_id = ?").bind(artifactId, row.id).first();
  if (!item) throw new ServiceError(404, "artifact_not_found");
  const stored = await blobFor(env).get(item.object_key);
  if (!stored) throw new ServiceError(409, "artifact_missing");
  const bytes = await stored.text();
  if (await serviceHash(bytes) !== item.sha256 || new TextEncoder().encode(bytes).byteLength !== item.byte_length) {
    throw new ServiceError(409, "artifact_integrity_failure");
  }
  return { item, bytes };
}
async function removeUncommittedArtifact(env, saved) {
  try {
    const committed = await dbFor(env).prepare("SELECT id FROM service_artifacts WHERE id = ?").bind(saved.artifactId).first();
    if (!committed) await blobFor(env).delete(saved.key);
  } catch {
  }
}
async function publishOutbox(env, appId) {
  if (!env.PRODUCT_COMMANDS) return;
  const db = dbFor(env);
  const at = now();
  const stale = new Date(Date.now() - 15 * 6e4).toISOString();
  const rows = await db.prepare(`SELECT * FROM service_outbox WHERE app_id = ? AND available_at <= ?
    AND (status = 'pending' OR (status = 'published' AND published_at < ?)) ORDER BY created_at LIMIT 50`).bind(appId, at, stale).all();
  for (const row of rows.results) {
    if (row.attempts >= 8) {
      await db.prepare("UPDATE service_outbox SET status = 'dead_letter' WHERE id = ? AND status != 'completed'").bind(row.id).run();
      continue;
    }
    try {
      await env.PRODUCT_COMMANDS.send({ kind: "service_delivery", app_id: appId, tenant_id: row.tenant_id, outbox_id: row.id });
      await db.prepare("UPDATE service_outbox SET status = 'published', published_at = ?, attempts = attempts + 1 WHERE id = ? AND status IN ('pending','published')").bind(at, row.id).run();
    } catch {
      await db.prepare("UPDATE service_outbox SET attempts = attempts + 1 WHERE id = ? AND status != ?").bind(row.id, "completed").run();
    }
  }
}
async function runServiceSweep(env, appId) {
  if (env.SERVICE_DELIVERY_ENABLED !== "true") return;
  const db = dbFor(env);
  const at = now();
  await db.prepare(`INSERT OR IGNORE INTO service_outbox (id, case_id, app_id, tenant_id, kind, status, available_at, created_at)
    SELECT 'followup:' || id || ':' || follow_up_at, id, app_id, tenant_id, 'follow_up', 'pending', ?, ?
    FROM service_cases WHERE app_id = ? AND follow_up_at <= ? AND status NOT IN ('resolved','cancelled','failed')`).bind(at, at, appId, at).run();
  await publishOutbox(env, appId);
}
function isServiceMessage(body) {
  return Boolean(body && typeof body === "object" && body.kind === "service_delivery");
}
async function processServiceMessage(env, appId, body, queueName = "") {
  if (!isServiceMessage(body)) return false;
  if (body.app_id !== appId || typeof body.tenant_id !== "string" || typeof body.outbox_id !== "string") return true;
  if (env.SERVICE_DELIVERY_ENABLED !== "true") throw new ServiceError(503, "service_not_enabled");
  const db = dbFor(env);
  const outbox = await db.prepare("SELECT * FROM service_outbox WHERE id = ? AND app_id = ? AND tenant_id = ?").bind(body.outbox_id, appId, body.tenant_id).first();
  if (!outbox || ["completed", "dead_letter"].includes(outbox.status)) return true;
  if (/(?:^|[-_])(?:dlq|dead[-_]?letter)(?:$|[-_])/i.test(queueName)) {
    await db.prepare("UPDATE service_outbox SET status = 'dead_letter' WHERE id = ? AND status != 'completed'").bind(outbox.id).run();
    return true;
  }
  await locked(env, `${appId}:${outbox.tenant_id}:${outbox.case_id}`, async () => {
    const fresh = await db.prepare("SELECT status FROM service_outbox WHERE id = ?").bind(outbox.id).first();
    if (!fresh || ["completed", "dead_letter"].includes(fresh.status)) return;
    const row = await db.prepare("SELECT * FROM service_cases WHERE id = ? AND app_id = ? AND tenant_id = ?").bind(outbox.case_id, appId, outbox.tenant_id).first();
    const finish = db.prepare("UPDATE service_outbox SET status = 'completed', completed_at = ? WHERE id = ?").bind(now(), outbox.id);
    if (!row || ["resolved", "cancelled", "failed"].includes(row.status) || outbox.kind === "intake" && row.status !== "submitted") {
      await finish.run();
      return;
    }
    if (outbox.kind === "follow_up") {
      await transition(db, row, "service_scheduler", "follow_up_due", row.status, {}, [finish]);
      return;
    }
    const saved = await artifact(env, row, "intake_receipt", "service_scheduler", {
      kind: "intake_receipt",
      case_id: row.id,
      request: JSON.parse(row.request_json),
      outcome: serviceContract(appId)?.outcome,
      requires_work_and_review: true
    });
    try {
      await transition(db, row, "service_scheduler", "intake_received", "in_progress", {}, [saved.statement, finish]);
    } catch (error) {
      await removeUncommittedArtifact(env, saved);
      throw error;
    }
  });
  return true;
}
async function consumeServiceBatch(env, appId, batch) {
  const remaining = [];
  for (const message of batch.messages) {
    if (!isServiceMessage(message.body)) {
      remaining.push(message);
      continue;
    }
    try {
      await processServiceMessage(env, appId, message.body, batch.queue);
      message.ack?.();
    } catch {
      message.retry?.();
    }
  }
  return { ...batch, messages: remaining };
}
async function handleServiceRequest(request, env, appId, trustedIdentity) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/service" && !url.pathname.startsWith("/api/service/")) return null;
  try {
    const contract = serviceContract(appId);
    if (!contract) throw new ServiceError(404, "service_contract_not_found");
    if (request.method === "GET" && url.pathname === "/api/service") {
      return serviceJson({
        contract,
        enabled: env.SERVICE_DELIVERY_ENABLED === "true",
        automation: "intake_receipts_and_follow_up_tracking",
        domain_execution: "existing_domain_workflows_with_authorized_operator_review"
      });
    }
    if (env.SERVICE_DELIVERY_ENABLED !== "true") throw new ServiceError(503, "service_not_enabled");
    let identity = trustedIdentity;
    if (!identity) {
      const auth = await authenticateRequest(request, { ...env, AUTH_ENFORCEMENT: "verified" }, { requireToken: true });
      if (auth instanceof Response) return auth;
      if (!auth.claims?.sub) throw new ServiceError(401, "verified_identity_required");
      identity = { tenantId: auth.tenantId, actorId: auth.claims.sub, roles: auth.claims.roles ?? [] };
    }
    const db = dbFor(env);
    const appScope = [appId, identity.tenantId];
    if (url.pathname === "/api/service/cases" && request.method === "GET") {
      const rows = await db.prepare(`SELECT * FROM service_cases WHERE app_id = ? AND tenant_id = ?
        ${isOperator(identity) ? "" : "AND owner_id = ?"} ORDER BY created_at DESC, id DESC LIMIT 100`).bind(...appScope, ...isOperator(identity) ? [] : [identity.actorId]).all();
      return serviceJson({ cases: rows.results.map(visibleCase) });
    }
    if (url.pathname === "/api/service/cases" && request.method === "POST") {
      if (appId === "app-054") return serviceJson({ error: "referral_only", referral_url: "https://ratethelandlord.org/" }, 409);
      const body2 = await serviceBody(request);
      only(body2, ["summary", "resource_type", "resource_id", "consent"]);
      if (body2.consent !== true) throw new ServiceError(400, "explicit_case_processing_consent_required");
      const input = {
        summary: text(body2.summary, "summary", 8e3),
        resource_type: text(body2.resource_type, "resource_type", 100),
        resource_id: text(body2.resource_id, "resource_id"),
        consent: true
      };
      const key = text(request.headers.get("idempotency-key"), "idempotency_key", 160);
      const serialized = JSON.stringify(input);
      const digest = await serviceHash(serialized);
      const caseId2 = await serviceHash(JSON.stringify([...appScope, identity.actorId, key]));
      const at = now();
      const created = await locked(env, caseId2, async () => {
        const existing = await db.prepare("SELECT * FROM service_cases WHERE id = ?").bind(caseId2).first();
        if (existing) {
          if (existing.input_hash !== digest) throw new ServiceError(409, "idempotency_payload_mismatch");
          return { row: existing, replayed: true };
        }
        await db.batch([
          db.prepare(`INSERT INTO service_cases (id, app_id, tenant_id, owner_id, idempotency_key, input_hash,
            request_json, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', 1, ?, ?)`).bind(caseId2, ...appScope, identity.actorId, key, digest, serialized, at, at),
          db.prepare(`INSERT INTO service_case_events (id, case_id, version, actor_id, action, created_at) VALUES (?, ?, 1, ?, 'submitted', ?)`).bind(id(), caseId2, identity.actorId, at),
          db.prepare(`INSERT INTO service_outbox (id, case_id, app_id, tenant_id, kind, status, available_at, created_at)
            VALUES (?, ?, ?, ?, 'intake', 'pending', ?, ?)`).bind(`intake:${caseId2}`, caseId2, ...appScope, at, at)
        ]);
        return { row: await loadCase(db, appId, identity, caseId2), replayed: false };
      });
      await publishOutbox(env, appId).catch(() => void 0);
      return serviceJson({ case: visibleCase(created.row), replayed: created.replayed }, created.replayed ? 200 : 201);
    }
    if (url.pathname === "/api/service/operations" && request.method === "GET") {
      requireOperator(identity);
      const states = await db.prepare("SELECT status, COUNT(*) AS count FROM service_cases WHERE app_id = ? AND tenant_id = ? GROUP BY status").bind(...appScope).all();
      const costs = await db.prepare(`SELECT c.currency, c.category, SUM(c.amount_minor) AS total_minor FROM service_costs c
        JOIN service_cases s ON s.id = c.case_id WHERE s.app_id = ? AND s.tenant_id = ? GROUP BY c.currency, c.category`).bind(...appScope).all();
      const deadLetters = await db.prepare("SELECT id, case_id, kind, attempts FROM service_outbox WHERE app_id = ? AND tenant_id = ? AND status = 'dead_letter'").bind(...appScope).all();
      return serviceJson({
        states: states.results,
        recorded_costs: costs.results,
        dead_letters: deadLetters.results,
        outcome_basis: "beneficiary_confirmed_not_independent_external_verification",
        costs_complete: false
      });
    }
    const match = url.pathname.match(/^\/api\/service\/cases\/([a-zA-Z0-9-]+)(?:\/(.*))?$/);
    if (!match) throw new ServiceError(404, "service_route_not_found");
    const [, caseId, action] = match;
    const row = await loadCase(db, appId, identity, caseId);
    if (request.method === "GET" && !action) {
      const events = await db.prepare("SELECT * FROM service_case_events WHERE case_id = ? ORDER BY version").bind(caseId).all();
      const artifacts = await db.prepare("SELECT id, kind, sha256, byte_length, created_at FROM service_artifacts WHERE case_id = ? ORDER BY created_at").bind(caseId).all();
      return serviceJson({ case: visibleCase(row), events: events.results, artifacts: artifacts.results });
    }
    if (request.method === "GET" && action?.startsWith("artifacts/")) {
      const checked = await checkedArtifact(env, row, action.slice("artifacts/".length));
      return new Response(checked.bytes, { headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "content-disposition": 'attachment; filename="service-evidence.json"',
        "x-content-type-options": "nosniff"
      } });
    }
    if (request.method !== "POST") throw new ServiceError(405, "method_not_allowed");
    const body = await serviceBody(request);
    const actor = identity;
    return await locked(env, `${appId}:${actor.tenantId}:${caseId}`, async () => {
      const current = await loadCase(db, appId, actor, caseId);
      if (!Number.isSafeInteger(body.version) || body.version !== current.version) throw new ServiceError(409, "case_version_conflict");
      if (action === "costs") {
        requireOperator(actor);
        only(body, ["version", "category", "amount_minor", "currency", "source_reference"]);
        if (!["compute", "review", "support", "provider", "infrastructure"].includes(String(body.category))) throw new ServiceError(400, "invalid_cost_category");
        if (!Number.isSafeInteger(body.amount_minor) || Number(body.amount_minor) < 0) throw new ServiceError(400, "invalid_cost_amount");
        const currency = text(body.currency, "currency", 3).toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) throw new ServiceError(400, "invalid_currency");
        const reference = text(body.source_reference, "source_reference");
        const existing = await db.prepare("SELECT * FROM service_costs WHERE case_id = ? AND source_reference = ?").bind(caseId, reference).first();
        if (existing) {
          if (existing.amount_minor !== body.amount_minor || existing.currency !== currency || existing.category !== body.category) throw new ServiceError(409, "cost_reference_conflict");
          return serviceJson({ recorded: true, replayed: true });
        }
        await transition(db, current, actor.actorId, "cost_recorded", current.status, {}, [
          db.prepare("INSERT INTO service_costs (id, case_id, category, amount_minor, currency, source_reference, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id(), caseId, body.category, body.amount_minor, currency, reference, actor.actorId, now())
        ]);
      } else if (action === "claim" || action === "follow-up") {
        requireOperator(actor);
        only(body, ["version", "follow_up_at"]);
        if (["resolved", "cancelled", "failed"].includes(current.status)) throw new ServiceError(409, "case_terminal");
        const due = text(body.follow_up_at, "follow_up_at", 40);
        if (!Number.isFinite(Date.parse(due)) || Date.parse(due) <= Date.now()) throw new ServiceError(400, "future_follow_up_required");
        await transition(
          db,
          current,
          actor.actorId,
          action === "claim" ? "assigned" : "follow_up_scheduled",
          current.status,
          { assigned: actor.actorId, followup: new Date(due).toISOString() }
        );
      } else if (action === "prepare" || action === "handoff") {
        requireOperator(actor);
        only(body, ["version", "content", "approved_artifact_id"]);
        const next = action === "prepare" ? "prepared" : "handed_off";
        if (action === "prepare" && !["in_progress", "prepared"].includes(current.status)) throw new ServiceError(409, "case_not_in_progress");
        if (action === "handoff" && (current.status !== "approved" || body.approved_artifact_id !== current.approved_artifact_id)) throw new ServiceError(409, "approved_artifact_required");
        if (!body.content || typeof body.content !== "object" || Array.isArray(body.content)) throw new ServiceError(400, "evidence_content_required");
        if (action === "handoff") {
          await checkedArtifact(env, current, current.approved_artifact_id);
          text(body.content.receipt_reference, "receipt_reference");
        }
        const saved = await artifact(
          env,
          current,
          action === "prepare" ? "prepared_work" : "handoff_receipt",
          actor.actorId,
          { kind: action, evidence_basis: "operator_recorded", content: body.content, approved_artifact_id: action === "handoff" ? current.approved_artifact_id : null }
        );
        try {
          await transition(
            db,
            current,
            actor.actorId,
            action,
            next,
            action === "prepare" ? { prepared: saved.artifactId } : { handoff: saved.artifactId },
            [saved.statement]
          );
        } catch (error) {
          await removeUncommittedArtifact(env, saved);
          throw error;
        }
      } else if (action === "approve") {
        ownerOnly(current, actor);
        only(body, ["version", "artifact_id", "sha256", "approve"]);
        if (current.status !== "prepared" || body.approve !== true || body.artifact_id !== current.prepared_artifact_id) throw new ServiceError(409, "prepared_artifact_approval_required");
        const checked = await checkedArtifact(env, current, current.prepared_artifact_id);
        if (body.sha256 !== checked.item.sha256) throw new ServiceError(409, "approval_digest_mismatch");
        await transition(db, current, actor.actorId, "beneficiary_approved", "approved", { approved: checked.item.id });
      } else if (action === "resolve") {
        ownerOnly(current, actor);
        only(body, ["version", "confirm"]);
        if (current.status !== "handed_off" || body.confirm !== true || !current.handoff_artifact_id) throw new ServiceError(409, "handoff_and_confirmation_required");
        await checkedArtifact(env, current, current.handoff_artifact_id);
        await transition(db, current, actor.actorId, "beneficiary_confirmed_resolution", "resolved");
      } else if (action === "cancel" || action === "fail") {
        only(body, ["version"]);
        if (action === "fail") requireOperator(actor);
        else ownerOnly(current, actor);
        if (["resolved", "cancelled", "failed"].includes(current.status)) throw new ServiceError(409, "case_terminal");
        await transition(db, current, actor.actorId, action, action === "cancel" ? "cancelled" : "failed");
      } else if (action === "redrive") {
        requireOperator(actor);
        only(body, ["version", "outbox_id"]);
        if (["resolved", "cancelled", "failed"].includes(current.status)) throw new ServiceError(409, "case_terminal");
        const outboxId = text(body.outbox_id, "outbox_id");
        const item = await db.prepare("SELECT id FROM service_outbox WHERE id = ? AND case_id = ? AND status = 'dead_letter'").bind(outboxId, caseId).first();
        if (!item) throw new ServiceError(404, "dead_letter_not_found");
        await transition(db, current, actor.actorId, "redrive_requested", current.status, {}, [
          db.prepare("UPDATE service_outbox SET status = 'pending', attempts = 0, available_at = ?, published_at = NULL WHERE id = ?").bind(now(), outboxId)
        ]);
      } else throw new ServiceError(404, "service_action_not_found");
      return serviceJson({ case: visibleCase(await loadCase(db, appId, actor, caseId)) });
    });
  } catch (error) {
    if (error instanceof ServiceError) return serviceJson({ error: error.code }, error.status);
    return serviceJson({ error: "service_operation_unavailable" }, 503);
  }
}

// shared/service-donations.ts
async function validSignature(raw, header, secret) {
  if (!header) return false;
  const fields = header.split(",").map((part) => part.trim().split("="));
  const timestamps = fields.filter(([key2]) => key2 === "t");
  if (timestamps.length !== 1) return false;
  const timestamp = Number(timestamps[0][1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1e3 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const payload = new TextEncoder().encode(`${timestamp}.${raw}`);
  for (const [, signature] of fields.filter(([name]) => name === "v1")) {
    if (!/^[a-f0-9]{64}$/.test(signature ?? "")) continue;
    const bytes = Uint8Array.from(signature.match(/../g), (part) => parseInt(part, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, payload)) return true;
  }
  return false;
}
async function handleDonationRequest(request, env, appId, trustedIdentity) {
  const path = new URL(request.url).pathname;
  if (!["/api/service/donations", "/api/service/donations/webhook"].includes(path)) return null;
  const db = env.DB ?? env.PRODUCT_DB;
  if (env.SERVICE_DELIVERY_ENABLED !== "true" || !db) return serviceJson({ error: "service_not_enabled" }, 503);
  try {
    if (path.endsWith("/webhook")) {
      if (request.method !== "POST") return serviceJson({ error: "method_not_allowed" }, 405);
      if (!env.SERVICE_DONATION_WEBHOOK_SECRET) return serviceJson({ error: "donation_provider_not_configured" }, 503);
      const raw = await serviceRawBody(request);
      if (!await validSignature(raw, request.headers.get("stripe-signature"), env.SERVICE_DONATION_WEBHOOK_SECRET)) return serviceJson({ error: "invalid_webhook_signature" }, 400);
      const event = JSON.parse(raw);
      if (typeof event.id !== "string" || !event.id.startsWith("evt_")) return serviceJson({ error: "invalid_event" }, 400);
      if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(event.type)) return serviceJson({ received: true, ignored: true });
      const session = event.data?.object;
      if (!session || typeof session.id !== "string") return serviceJson({ error: "invalid_session" }, 400);
      const donation2 = await db.prepare("SELECT * FROM service_donations WHERE app_id = ? AND checkout_id = ?").bind(appId, session.id).first();
      if (!donation2) return serviceJson({ error: "checkout_not_registered" }, 409);
      const metadata = session.metadata;
      if (session.mode !== "payment" || session.amount_total !== donation2.amount_minor || session.currency !== donation2.currency || metadata?.service_donation_id !== donation2.id || metadata?.app_id !== appId) return serviceJson({ error: "donation_receipt_mismatch" }, 400);
      const paid = event.type !== "checkout.session.expired" && session.payment_status === "paid";
      if (!paid && event.type !== "checkout.session.expired") return serviceJson({ received: true, awaiting_payment: true });
      if (paid && (typeof session.payment_intent !== "string" || !session.payment_intent.startsWith("pi_"))) return serviceJson({ error: "payment_reference_required" }, 400);
      const at2 = (/* @__PURE__ */ new Date()).toISOString();
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO service_donation_events (provider_event_id, donation_id, event_type, received_at) VALUES (?, ?, ?, ?)").bind(event.id, donation2.id, event.type, at2),
        paid ? db.prepare("UPDATE service_donations SET status = 'succeeded', confirmed_at = COALESCE(confirmed_at, ?), payment_reference = ? WHERE id = ?").bind(at2, session.payment_intent, donation2.id) : db.prepare("UPDATE service_donations SET status = 'expired' WHERE id = ? AND status = 'pending'").bind(donation2.id)
      ]);
      return serviceJson({ received: true });
    }
    let identity = trustedIdentity;
    if (!identity) {
      const auth = await authenticateRequest(request, { ...env, AUTH_ENFORCEMENT: "verified" }, { requireToken: true });
      if (auth instanceof Response) return auth;
      if (!auth.claims?.sub) return serviceJson({ error: "verified_identity_required" }, 401);
      identity = { actorId: auth.claims.sub, tenantId: auth.tenantId, roles: auth.claims.roles ?? [] };
    }
    if (request.method === "GET") {
      const rows = await db.prepare(`SELECT id, amount_minor, currency, status, created_at, confirmed_at FROM service_donations
        WHERE app_id = ? AND tenant_id = ? AND donor_id = ? ORDER BY created_at DESC LIMIT 100`).bind(appId, identity.tenantId, identity.actorId).all();
      return serviceJson({ donations: rows.results });
    }
    if (request.method !== "POST") return serviceJson({ error: "method_not_allowed" }, 405);
    const body = await serviceBody(request);
    if (Object.keys(body).some((key) => !["amount_minor", "currency"].includes(key)) || !Number.isSafeInteger(body.amount_minor) || Number(body.amount_minor) < 100 || Number(body.amount_minor) > 1e6 || body.currency !== "usd") {
      return serviceJson({ error: "donation_requires_usd_integer_amount_from_100_to_1000000_minor_units" }, 400);
    }
    const idem = request.headers.get("idempotency-key");
    if (!idem || idem.length > 160) return serviceJson({ error: "idempotency_key_required" }, 400);
    if (!env.SERVICE_DONATION_STRIPE_KEY || !env.SERVICE_DONATION_WEBHOOK_SECRET || !env.SERVICE_DONATION_RETURN_URL) return serviceJson({ error: "donation_provider_not_configured" }, 503);
    const returnUrl = new URL(env.SERVICE_DONATION_RETURN_URL);
    if (returnUrl.protocol !== "https:" || returnUrl.username || returnUrl.password) return serviceJson({ error: "invalid_donation_return_configuration" }, 503);
    const donationId = await serviceHash(JSON.stringify([appId, identity.tenantId, identity.actorId, idem]));
    const at = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`INSERT OR IGNORE INTO service_donations (id, app_id, tenant_id, donor_id, idempotency_key,
      amount_minor, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'usd', 'pending', ?)`).bind(donationId, appId, identity.tenantId, identity.actorId, idem, body.amount_minor, at).run();
    const donation = await db.prepare("SELECT * FROM service_donations WHERE id = ?").bind(donationId).first();
    if (!donation || donation.amount_minor !== body.amount_minor) return serviceJson({ error: "idempotency_payload_mismatch" }, 409);
    if (donation.status !== "pending" || donation.checkout_url) return serviceJson({ donation_id: donationId, status: donation.status, checkout_url: donation.status === "pending" ? donation.checkout_url : null });
    if (Date.now() - Date.parse(donation.created_at) > 23 * 36e5) return serviceJson({ error: "checkout_attempt_expired_use_new_idempotency_key" }, 409);
    const form = new URLSearchParams({
      mode: "payment",
      success_url: returnUrl.href,
      cancel_url: returnUrl.href,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(donation.amount_minor),
      "line_items[0][price_data][product_data][name]": `Voluntary support for ${appId}`,
      "line_items[0][quantity]": "1",
      "metadata[service_donation_id]": donationId,
      "metadata[app_id]": appId
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.SERVICE_DONATION_STRIPE_KEY}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `service-donation-${donationId}` },
      body: form
    });
    if (!response.ok) return serviceJson({ error: "donation_checkout_unavailable", donation_id: donationId }, 502);
    const checkout = await response.json();
    if (!checkout.id?.startsWith("cs_") || !checkout.url || new URL(checkout.url).origin !== "https://checkout.stripe.com") return serviceJson({ error: "invalid_provider_checkout" }, 502);
    await db.prepare("UPDATE service_donations SET checkout_id = ?, checkout_url = ? WHERE id = ? AND checkout_id IS NULL").bind(checkout.id, checkout.url, donationId).run();
    return serviceJson({
      donation_id: donationId,
      status: "pending",
      checkout_url: checkout.url,
      funding_policy: serviceContract(appId)?.funding
    }, 201);
  } catch (error) {
    const status = typeof error.status === "number" ? error.status : 503;
    return serviceJson({ error: status < 500 ? "invalid_donation_request" : "donation_operation_unavailable" }, status);
  }
}

// shared/service-gateway.ts
async function handleServiceGateway(request, env, appId, identity) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/service" && !url.pathname.startsWith("/api/service/")) return null;
  const origin = request.headers.get("origin");
  const allowed = /* @__PURE__ */ new Set([url.origin, ...(env.SERVICE_ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean)]);
  if (origin && !allowed.has(origin)) return serviceJson({ error: "service_origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, idempotency-key",
    ...origin ? { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", vary: "Origin" } : {}
  } });
  if (request.method === "POST" && !url.pathname.endsWith("/donations/webhook") && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return serviceJson({ error: "application_json_required" }, 415);
  }
  const response = await handleDonationRequest(request, env, appId, identity) ?? await handleServiceRequest(request, env, appId, identity);
  if (response && origin) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-allow-credentials", "true");
    response.headers.set("vary", "Origin");
  }
  return response;
}

// shared/product-coordinator-do.ts
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function scopeFromUrl(url) {
  return url.searchParams.get("scope") || "default";
}
function normalizeScope(value) {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 160) || "default";
}
function stateKey(scope) {
  return `state:${normalizeScope(scope)}`;
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
var ProductCoordinator = class {
  constructor(state) {
    this.state = state;
  }
  async load(scope) {
    const stored = await this.state.storage.get(stateKey(scope));
    return stored ?? {
      scope,
      events: [],
      locks: {},
      updated_at: nowIso()
    };
  }
  async save(next) {
    await this.state.storage.put(stateKey(next.scope), next);
  }
  async fetch(request) {
    const url = new URL(request.url);
    const scope = normalizeScope(scopeFromUrl(url));
    const current = await this.load(scope);
    if (request.method === "GET" && url.pathname === "/state") {
      return json(current);
    }
    if (request.method === "POST" && url.pathname === "/events") {
      const body = await readJson(request);
      if (!body.event_type) return badRequest("event_type is required");
      const now2 = nowIso();
      const event = {
        event_type: body.event_type,
        actor_id: body.actor_id ?? null,
        payload: asRecord(body.payload),
        occurred_at: now2
      };
      const next = {
        ...current,
        events: [...current.events.slice(-99), event],
        updated_at: now2
      };
      await this.save(next);
      return json({ accepted: true, state: next }, 202);
    }
    if (request.method === "POST" && url.pathname === "/locks/acquire") {
      const body = await readJson(request);
      if (!body.lock_id || !body.owner_id) return badRequest("lock_id and owner_id are required");
      const now2 = Date.now();
      const existing = current.locks[body.lock_id];
      const existingExpiresAt = typeof existing?.expires_at === "string" ? new Date(existing.expires_at).getTime() : 0;
      if (existing && existingExpiresAt > now2 && existing.owner_id !== body.owner_id) {
        return json({ acquired: false, lock: existing }, 409);
      }
      const ttlSeconds = Math.max(1, Math.min(Number(body.ttl_seconds ?? 300), 3600));
      const lock = {
        lock_id: body.lock_id,
        owner_id: body.owner_id,
        acquired_at: nowIso(),
        expires_at: new Date(now2 + ttlSeconds * 1e3).toISOString()
      };
      const next = {
        ...current,
        locks: { ...current.locks, [body.lock_id]: lock },
        updated_at: nowIso()
      };
      await this.save(next);
      return json({ acquired: true, lock });
    }
    if (request.method === "POST" && url.pathname === "/locks/release") {
      const body = await readJson(request);
      if (!body.lock_id) return badRequest("lock_id is required");
      const existing = current.locks[body.lock_id];
      if (existing && body.owner_id && existing.owner_id !== body.owner_id) {
        return json({ released: false, lock: existing }, 409);
      }
      const locks = { ...current.locks };
      delete locks[body.lock_id];
      const next = {
        ...current,
        locks,
        updated_at: nowIso()
      };
      await this.save(next);
      return json({ released: true });
    }
    return json({ error: "not_found" }, 404);
  }
};
export {
  ProductCoordinator as DonationServiceCoordinator,
  consumeServiceBatch,
  handleServiceGateway,
  processServiceMessage,
  runServiceSweep,
  serviceContract,
  serviceJson
};
