---
"messageweave": minor
---

Resolve N+1 database queries in `publishEvent` parent validation and `getRoomState` state resolution by batching queries with `findMany`.
