# Cloudflare Field-Level Parity (Python Backend)

## Inventory

- Source inventory file: `docs/.python-model-fields.json`
- Generated Worker registry: `cloudflare/src/shared/model-field-registry.ts`
- Feature-family field checklist: `docs/cloudflare-feature-family-field-checklist.md`
- Registry size: 445 model classes, 4443 fields

## Enforcement

Field-level parity is enforced in `cloudflare/src/command-worker.ts` by:

1. Resolving `model_key` from command type mapping or `payload.model_key`.
2. Resolving expected fields from Python registry or `payload.model_fields`.
3. Merging incoming payload into parity snapshot (`field_parity_records`) for the `(tenant_id, model_key, record_id)` tuple.
4. Computing missing/extra fields and failing command processing when strict mode is enabled and missing fields are detected.
5. Writing primitive field index rows (`field_parity_field_index`) for fast validation queries.
6. Offloading large snapshots to R2 with D1 pointer (`data_ref`) for cost control.

## D1 Tables

- `field_parity_models`
- `field_parity_records`
- `field_parity_field_index`

## API Endpoints

- `GET /api/v2/parity/models`
- `POST /api/v2/parity/models/seed`
- `GET /api/v2/parity/records`
- `GET /api/v2/parity/validate`
- `GET /api/v2/parity/checklist` (feature-family -> command -> expected field matrix)
- `GET /api/v2/parity/coverage` (tenant-scoped completeness across feature families)

## Required Command Payload Fields (for strict parity)

For commands where `model_key` cannot be inferred from built-in mapping, provide:

- `payload.model_key`
- `payload.record_id` or `payload.entity_id` or `payload.id`
- `payload.model_fields` when model key is not in Python registry

Strict mode env var:

- `STRICT_FIELD_PARITY=true`
