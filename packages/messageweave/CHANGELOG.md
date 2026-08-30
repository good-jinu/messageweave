# messageweave

## 0.1.0

### Minor Changes

- [`9036e0a`](https://github.com/good-jinu/messageweave/commit/9036e0abda8957c4d79952e4016a2c4e0c4f6970) Thanks [@good-jinu](https://github.com/good-jinu)! - Add built-in Drizzle, Prisma, Kysely, Knex, MongoDB, and Sumak storage entry
  points backed internally by Unadapter, and share one framework-neutral schema
  between the runtime integrations and schema CLI.

- [#10](https://github.com/good-jinu/messageweave/pull/10) [`7e86f88`](https://github.com/good-jinu/messageweave/commit/7e86f8847cef1261f5257b07070123a9b0d3c3da) Thanks [@good-jinu](https://github.com/good-jinu)! - Add Drizzle ORM and Prisma schema generation to both the core library and CLI:

  - Upgrade `unadapter` to `^0.4.0`.
  - Expose programmatic schema generators `generateDrizzleSchema`, `generatePrismaSchema`, and `generateMessageWeaveSchema` from `messageweave/schema` and the main entry point.
  - Add `--format <sql|drizzle|prisma>`, `--provider`, and `--include-datasource` flags to `messageweave schema generate` in `@messageweave/cli`.

- [#6](https://github.com/good-jinu/messageweave/pull/6) [`8e04065`](https://github.com/good-jinu/messageweave/commit/8e04065029e147f1a0ecd347ca3bed308114299c) Thanks [@good-jinu](https://github.com/good-jinu)! - Initial public release of MessageWeave and its schema-generation CLI.

- [#11](https://github.com/good-jinu/messageweave/pull/11) [`820495d`](https://github.com/good-jinu/messageweave/commit/820495db43fd9d740df3d33ea375dd548937f1af) Thanks [@good-jinu](https://github.com/good-jinu)! - Add message edit and delete support and timeline projection helper:

  - Add `editMessage()` to `ChatCore` to publish immutable `message.edit` revision events.
  - Add `deleteMessage()` to `ChatCore` to publish immutable `message.delete` tombstone events.
  - Export `projectTimeline()` utility to fold event streams (revisions and deletions) into UI-ready `ProjectedMessage` models.
  - Export `EditMessageInput`, `DeleteMessageInput`, `ProjectedMessage`, and `ProjectTimelineOptions` types.

- [#12](https://github.com/good-jinu/messageweave/pull/12) [`a8e32f9`](https://github.com/good-jinu/messageweave/commit/a8e32f9cf02112684a9c3199dd709e70c921aa1b) Thanks [@good-jinu](https://github.com/good-jinu)! - Refactor database adapter naming conventions and improve Prisma adapter DX.

  - Renamed all exported adapter functions and options interfaces from `*Storage` and `*StorageOptions` to `*Adapter` and `*AdapterOptions` (e.g., `prismaStorage` -> `prismaAdapter`).
  - The `provider` property is now optional in `PrismaAdapterOptions`. If omitted, the adapter will attempt to infer the database provider from the Prisma client instance automatically.

- [#15](https://github.com/good-jinu/messageweave/pull/15) [`fb8ad3f`](https://github.com/good-jinu/messageweave/commit/fb8ad3f32d2987d7af31519651cb4a72af1ab675) Thanks [@good-jinu](https://github.com/good-jinu)! - Resolve N+1 database queries in `publishEvent` parent validation and `getRoomState` state resolution by batching queries with `findMany`.

## 0.2.0

### Minor Changes

- [#2](https://github.com/good-jinu/chatcore/pull/2) [`c242a01`](https://github.com/good-jinu/chatcore/commit/c242a01a7d66b7f40f6239982d67877f2d15d009) Thanks [@good-jinu](https://github.com/good-jinu)! - Add host-owned attachment reference types for media message payloads.

- [#3](https://github.com/good-jinu/chatcore/pull/3) [`4208db8`](https://github.com/good-jinu/chatcore/commit/4208db8d5dc55df92f01f3da567e77ef473ad838) Thanks [@good-jinu](https://github.com/good-jinu)! - Add a `sendMessage()` convenience method for publishing plain-text messages and replies.
