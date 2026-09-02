---
"messageweave": patch
---

Implement multi-process Optimistic Concurrency Control (CAS) sequence allocation:

- Use atomic conditional `update` queries on the `sequence` table with exponential backoff and jitter to prevent sequence collisions across concurrent processes.
- Ensure monotonic, collision-free global sequence assignment in multi-container and serverless deployments.
