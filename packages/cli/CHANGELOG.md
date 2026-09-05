# @messageweave/cli

## 0.2.0

### Minor Changes

- [#20](https://github.com/good-jinu/messageweave/pull/20) [`2e2c139`](https://github.com/good-jinu/messageweave/commit/2e2c13900b40e080c998469a39bb386ea197528b) Thanks [@good-jinu](https://github.com/good-jinu)! - Add lifecycle hooks, realtime subscriptions, and update package branding to MessageWeave:

  - Add `beforePublish`, `afterPublish`, and `onError` lifecycle hooks to `MessageWeaveOptions`.
  - Add `flow.subscribe()` async iterable stream and pluggable `PubSubAdapter` / `MemoryPubSubAdapter` for realtime event streaming.
  - Add `onEvent` subscriber registration to `MessageWeave` instance.
  - Update engine core exports and naming to `MessageWeave` / `createMessageWeave`.
  - Update CLI schema generation to support `messageweave` schemas across database adapters.

### Patch Changes

- Updated dependencies [[`0bab1d0`](https://github.com/good-jinu/messageweave/commit/0bab1d0286640f2336578ef8408e4c6dc7d6aba8), [`2e2c139`](https://github.com/good-jinu/messageweave/commit/2e2c13900b40e080c998469a39bb386ea197528b), [`350127f`](https://github.com/good-jinu/messageweave/commit/350127fd8ae2512dc7e3344e1a36a71b80a1b78a), [`ed2955c`](https://github.com/good-jinu/messageweave/commit/ed2955c7b966ccff1d7ce1ad92f3eda7f36485fd)]:
  - messageweave@0.2.0

## 0.1.0

### Minor Changes

- [#10](https://github.com/good-jinu/messageweave/pull/10) [`7e86f88`](https://github.com/good-jinu/messageweave/commit/7e86f8847cef1261f5257b07070123a9b0d3c3da) Thanks [@good-jinu](https://github.com/good-jinu)! - Add Drizzle ORM and Prisma schema generation to both the core library and CLI:

  - Upgrade `unadapter` to `^0.4.0`.
  - Expose programmatic schema generators `generateDrizzleSchema`, `generatePrismaSchema`, and `generateMessageWeaveSchema` from `messageweave/schema` and the main entry point.
  - Add `--format <sql|drizzle|prisma>`, `--provider`, and `--include-datasource` flags to `messageweave schema generate` in `@messageweave/cli`.

- [#6](https://github.com/good-jinu/messageweave/pull/6) [`8e04065`](https://github.com/good-jinu/messageweave/commit/8e04065029e147f1a0ecd347ca3bed308114299c) Thanks [@good-jinu](https://github.com/good-jinu)! - Initial public release of MessageWeave and its schema-generation CLI.

### Patch Changes

- [`9036e0a`](https://github.com/good-jinu/messageweave/commit/9036e0abda8957c4d79952e4016a2c4e0c4f6970) Thanks [@good-jinu](https://github.com/good-jinu)! - Add built-in Drizzle, Prisma, Kysely, Knex, MongoDB, and Sumak storage entry
  points backed internally by Unadapter, and share one framework-neutral schema
  between the runtime integrations and schema CLI.
- Updated dependencies [[`9036e0a`](https://github.com/good-jinu/messageweave/commit/9036e0abda8957c4d79952e4016a2c4e0c4f6970), [`7e86f88`](https://github.com/good-jinu/messageweave/commit/7e86f8847cef1261f5257b07070123a9b0d3c3da), [`8e04065`](https://github.com/good-jinu/messageweave/commit/8e04065029e147f1a0ecd347ca3bed308114299c), [`820495d`](https://github.com/good-jinu/messageweave/commit/820495db43fd9d740df3d33ea375dd548937f1af), [`a8e32f9`](https://github.com/good-jinu/messageweave/commit/a8e32f9cf02112684a9c3199dd709e70c921aa1b), [`fb8ad3f`](https://github.com/good-jinu/messageweave/commit/fb8ad3f32d2987d7af31519651cb4a72af1ab675)]:
  - messageweave@0.1.0

## 0.2.0

### Minor Changes

- [`4b671bb`](https://github.com/good-jinu/chatcore/commit/4b671bb4c12719dd27595053e1af95e4e70abc9b) Thanks [@good-jinu](https://github.com/good-jinu)! - Add a separate ChatCore CLI package with `chatcore schema generate` for SQL schema generation.
