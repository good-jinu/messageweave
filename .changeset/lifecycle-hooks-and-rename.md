---
"messageweave": minor
"@messageweave/cli": minor
---

Add lifecycle hooks, realtime subscriptions, and update package branding to MessageWeave:

- Add `beforePublish`, `afterPublish`, and `onError` lifecycle hooks to `MessageWeaveOptions`.
- Add `flow.subscribe()` async iterable stream and pluggable `PubSubAdapter` / `MemoryPubSubAdapter` for realtime event streaming.
- Add `onEvent` subscriber registration to `MessageWeave` instance.
- Update engine core exports and naming to `MessageWeave` / `createMessageWeave`.
- Update CLI schema generation to support `messageweave` schemas across database adapters.
