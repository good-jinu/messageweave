---
"messageweave": minor
"@messageweave/cli": minor
---

Add Drizzle ORM and Prisma schema generation to both the core library and CLI:

- Upgrade `unadapter` to `^0.4.0`.
- Expose programmatic schema generators `generateDrizzleSchema`, `generatePrismaSchema`, and `generateMessageWeaveSchema` from `messageweave/schema` and the main entry point.
- Add `--format <sql|drizzle|prisma>`, `--provider`, and `--include-datasource` flags to `messageweave schema generate` in `@messageweave/cli`.
