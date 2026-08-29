---
"messageweave": minor
---

Refactor database adapter naming conventions and improve Prisma adapter DX.

- Renamed all exported adapter functions and options interfaces from `*Storage` and `*StorageOptions` to `*Adapter` and `*AdapterOptions` (e.g., `prismaStorage` -> `prismaAdapter`).
- The `provider` property is now optional in `PrismaAdapterOptions`. If omitted, the adapter will attempt to infer the database provider from the Prisma client instance automatically.
