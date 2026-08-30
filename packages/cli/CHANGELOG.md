# @messageweave/cli

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
