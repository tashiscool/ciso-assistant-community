# Dead-letter replay integrity

Replay verifies the original R2 bytes against the receipt's SHA256 before UTF-8 decoding or JSON parsing. It then requires an object with a known message type, matching authenticated/receipt/payload tenant, matching receipt type, and an inferred original queue that agrees with the receipt. Required identities, optional GRC job/framework identities and supported report variants retain their current shapes. The existing queue union contains no numeric payload counters to validate.

Rejection uses static messages without payload, R2 path or URL contents. An invalid payload produces no queue send, dead-letter business-state update or audit event. The existing transient tenant Durable Object lease is acquired and released as before. Valid replay retains its existing state, event, queue-send and failed-send sequence; no migration, new queue, permission or producer-body change is included.

The verification script imports the real replay, routing and workflow helpers through the existing TypeScript compiler, with fake D1/R2/queue/DO bindings and network transport blocked:

```sh
node cloudflare/scripts/verify_replay_integrity.mjs
npm --prefix cloudflare run verify:queue-recovery
npm --prefix cloudflare run typecheck
```

Its 45 tests cover all current message families/report routes, byte tampering and swapped valid messages, malformed UTF-8/JSON, bad checksums, tenant/type/queue mismatches, required/optional identity shapes, missing storage/bindings, terminal/held-lease handling and the existing failed-send event flow. Hash consistency depends on the stored receipt; it does not provide an independent signature or exactly-once delivery guarantee. Queue redelivery, distributed timing and live production storage remain outside this fake-binding verification.
