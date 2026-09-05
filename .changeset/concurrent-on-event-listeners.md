---
"messageweave": patch
---

Execute `onEvent` listeners concurrently with `Promise.allSettled` and fast-path zero listeners:

- Use `Promise.allSettled` to execute registered in-process `onEvent` listeners concurrently, eliminating sequential emission latency waterfalls.
- Isolate listener errors so failing listeners cannot prevent other listeners from running or cause `publishEvent()` to throw after event persistence succeeds.
- Fast-path event emission when zero `onEvent` listeners are registered.
