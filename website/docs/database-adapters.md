---
id: database-adapters
title: Database Adapters
sidebar_position: 3
---

# Database Adapters

MessageWeave's engine accepts the stable `MessageWeaveStorage` interface. Built-in
entry points adapt common database clients to that interface while keeping
Unadapter as an internal MessageWeave implementation detail.

Install `messageweave` and only the database client you use. You do not need to
install or import `unadapter` directly.

## Drizzle

Pass the Drizzle client and the schema object containing MessageWeave's tables:

```ts
import { createMessageWeave } from "messageweave";
import { drizzleAdapter } from "messageweave/drizzle";

const flow = createMessageWeave({
  storage: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
});
```

Valid providers are `pg`, `mysql`, and `sqlite`.

## Prisma

Pass the generated Prisma client and its database provider:

```ts
import { createMessageWeave } from "messageweave";
import { prismaAdapter } from "messageweave/prisma";

const flow = createMessageWeave({
  storage: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
});
```

Your Prisma schema must include MessageWeave's models, and you must regenerate
the Prisma client after changing them.

## Kysely and Knex

```ts
import { createMessageWeave } from "messageweave";
import { kyselyAdapter } from "messageweave/kysely";

const flow = createMessageWeave({
  storage: kyselyAdapter(db, { type: "postgres" }),
});
```

Use `knexAdapter` from `messageweave/knex` for a Knex client. SQL-backed Kysely,
Knex, and Sumak integrations accept `postgres`, `mysql`, `sqlite`, or `mssql`.

## MongoDB

```ts
import { createMessageWeave } from "messageweave";
import { mongodbAdapter } from "messageweave/mongodb";

const flow = createMessageWeave({
  storage: mongodbAdapter(db),
});
```

Here `db` is a MongoDB `Db` instance.

## Generate the SQL schema

For PostgreSQL, MySQL, or SQLite, the CLI generates the five required tables:

```bash
pnpm dlx @messageweave/cli schema generate \
  --dialect postgres \
  --out migrations/001_messageweave.sql
```

The generated DDL is based on the same canonical schema used by the built-in
storage entry points. It works independently of whether runtime queries use
Drizzle, Prisma, Kysely, Knex, Sumak, or raw SQL.

The CLI creates database tables; it does not replace ORM metadata. Drizzle still
needs corresponding table definitions, and Prisma still needs corresponding
models in `schema.prisma`.

### ID strategy

String IDs generated in application code are the default. For another strategy,
use the same value in both the CLI and the storage helper:

```bash
pnpm dlx @messageweave/cli schema generate \
  --dialect postgres \
  --id-strategy uuid \
  --out migrations/001_messageweave.sql
```

```ts
const storage = drizzleAdapter(db, {
  provider: "pg",
  schema,
  idStrategy: "uuid",
});
```

Supported SQL strategies are `string`, `uuid`, `serial`, and `number`. Ensure
the selected strategy is supported by the database dialect and reflected in the
ORM schema.

## Custom storage

Database clients without a built-in entry point can implement
`MessageWeaveStorage` directly:

```ts
import { createMessageWeave, type MessageWeaveStorage } from "messageweave";

const storage: MessageWeaveStorage = createCustomStorage();
const flow = createMessageWeave({ storage });
```

This keeps the engine independent of any particular database library.

