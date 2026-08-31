# messageweave

An in-process, database-agnostic, event-sourced messaging engine for TypeScript.

```bash
pnpm add messageweave
```

```ts
import { getTestInstance } from "messageweave/test";

const { flow } = getTestInstance();

const room = await flow.createRoom({ creatorId: "u1" });
await flow.sendMessage({
  roomId: room.id,
  senderId: "u1",
  body: "hello",
});
const { events, nextToken } = await flow.getSyncStream({ sinceSequenceId: 0 });
```

## Data model

- **`FlowEvent`** — the atomic, immutable unit of state. Carries the
  monotonically increasing `sequenceId`.
- **`Room`** — an isolated conversation boundary.
- **`EventEdge`** — a parent → child link between events (threading / DAG).
- **Room state projection** — a cache keyed by `[roomId, type, stateKey]`
  pointing at the latest state event, so current state is read without replaying
  the whole timeline.

### Event Sourcing & DAG Flow Walkthrough

Every interaction in MessageWeave is an immutable `FlowEvent`. Chronological synchronization uses `sequenceId`, while parent/child relationships (like thread replies or edits) use `EventEdge` references (linking event string `id`s).

1. **User A sends "Hello"**
   - `sequenceId`: `101`
   - `event` inserted: `id = "evt_01"`, `type = "message.text"`, `content = { body: "Hello" }`.
   - `eventEdge`: *None* (Root message).

2. **User B replies "Hi!"**
   - `sequenceId`: `102`
   - `event` inserted: `id = "evt_02"`, `type = "message.text"`, `content = { body: "Hi!" }`.
   - `eventEdge` inserted: `eventId = "evt_02"`, `parentEventId = "evt_01"` (Reply edge).

3. **User A edits original message**
   - `sequenceId`: `103`
   - `event` inserted: `id = "evt_03"`, `type = "message.edit"`, `content = { targetMessageId: "evt_01", body: "Hello!!" }`.
   - `eventEdge` inserted: `eventId = "evt_03"`, `parentEventId = "evt_01"` (Mutation edge).

- **Chronological Sync:** Order by `sequenceId` (`101 → 102 → 103`) to drive real-time cursor sync.
- **Threaded View:** Traverses `eventEdge` links (`evt_01` → replies `evt_02`).
- **Projected View:** `projectTimeline(events)` folds edit (`evt_03`) into root message `evt_01` (`body: "Hello!!"`, `isEdited: true`).

## Choosing a database

MessageWeave persists through a storage backend passed as `options.storage`.
MessageWeave provides optional entry points for Unadapter's supported database
clients while keeping Unadapter itself out of application code.

For Drizzle, pass your database client and the same schema object used to create
it:

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

Install only the database library you use; `unadapter` is an internal
MessageWeave dependency and is not imported or configured by applications.
When provisioning with a non-default CLI `--id-strategy`, pass the same
`idStrategy` to the storage helper.

See the [Database Adapters guide](https://good-jinu.github.io/messageweave/database-adapters)
for setup examples. The generated
[API reference](https://good-jinu.github.io/messageweave/api/) lists every
currently exported adapter and option.

You can still provide a custom `MessageWeaveStorage` implementation when you need a
different database client or storage architecture.

**Sequencing & atomicity.** MessageWeave's current storage layer exposes no
cross-statement transaction primitive, so `publishEvent` is serialized
in-process to keep `sequenceId` strictly increasing. Integrity checks run before
sequence assignment, but storage failures during the serialized write can still
advance the stored counter. For multi-process deployments, back MessageWeave with a
storage implementation that provides its own atomic ordering.

**Testing.** For tests, use the included corrected in-memory helper:

```ts
import { getTestInstance } from "messageweave/test";

const { flow, db } = getTestInstance();
```

## Media and attachments

MessageWeave stores and synchronizes attachment references, not file bytes. The host
application owns upload, storage, authorization, delivery, and deletion. After
the host completes and verifies an upload, put its opaque attachment id and
portable presentation metadata in event content:

```ts
import type { AttachmentReference } from "messageweave";

const attachment = {
  id: "att_01JABCDEF",
  kind: "image",
  name: "photo.png",
  mimeType: "image/png",
  size: 483_920,
  width: 1920,
  height: 1080,
} satisfies AttachmentReference;

await flow.publishEvent({
  roomId,
  senderId: "u1",
  type: "message.media",
  content: {
    body: "A photo",
    attachments: [attachment],
  },
});
```

The attachment id is deliberately opaque to MessageWeave. The host may resolve it
to S3, GCS, R2, a CDN, local storage, or another media service. Do not store
object-store keys, credentials, or permanent signed URLs in event content.

A typical host workflow is: authorize the upload, issue a presigned URL or
accept a streamed upload, verify the completed object, create an attachment
record, publish its id in a message, and authorize each later download. The host
also owns quotas, MIME and size validation, malware scanning, thumbnails,
transcoding, retention, and orphan cleanup.

## Provisioning the schema

MessageWeave stores five tables — `room`, `event`, `eventEdge`, `roomState`,
`sequence`. How you create them depends on the adapter:

For SQL databases, the separate CLI package can generate starter DDL without
adding CLI-only dependencies to the runtime `messageweave` package:

```bash
pnpm dlx @messageweave/cli schema generate --dialect sqlite --out migrations/001_messageweave.sql
```

| Adapter | What you do |
| --- | --- |
| **Kysely** | Create the five tables with your migration tool or host-app bootstrapping code, then implement `MessageWeaveStorage` with normal Kysely queries. |
| **Drizzle** | Define the tables in your Drizzle schema (below), then manage migrations with `drizzle-kit`. |
| **Prisma** | Add the models below to `schema.prisma`, then run `prisma migrate` / `prisma db push`. |

### Logical column types

`MessageWeaveStorage` receives and returns logical JavaScript values. Your adapter
may store these as native JSON columns, serialized strings, `bigint`, or other
database-specific types, but it should map them back to the values shown here:

| messageweave field(s) | Storage type | SQL / Prisma type | Why |
| --- | --- | --- | --- |
| `createdAt`, `timestamp`, `sequenceId`, `value` | `number` | **`BigInt`** or integer | epoch-millis / counters, not `DateTime` |
| `metadata`, `content` | JSON object | **`Json`** or serialized string | adapters must return a plain JSON object |

### Prisma

Model names are PascalCase so Prisma's lowercased client accessors
(`prisma.room`, `prisma.eventEdge`, …) match the names MessageWeave queries. The
back-relations are required for Prisma to validate the `onDelete: Cascade`
foreign keys.

```prisma
model Room {
  id        String @id
  creatorId String
  createdAt BigInt
  metadata  String

  events Event[]
  states RoomState[]
}

model Event {
  id         String  @id
  roomId     String
  senderId   String
  type       String
  stateKey   String?
  content    String
  timestamp  BigInt
  sequenceId BigInt  @unique

  room   Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
  edges  EventEdge[]
  states RoomState[]
}

model EventEdge {
  id            String @id
  eventId       String
  parentEventId String

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
}

model RoomState {
  id        String @id
  roomId    String
  eventType String
  stateKey  String
  eventId   String

  room  Room  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
}

model Sequence {
  id    String @id
  name  String @unique
  value BigInt
}
```

The storage implementation creates row `id`s when MessageWeave calls `create`, so

the columns intentionally have no database default in this example.

### Drizzle (Postgres)

```ts
import { bigint, pgTable, text } from "drizzle-orm/pg-core";

export const room = pgTable("room", {
  id: text("id").primaryKey(),
  creatorId: text("creatorId").notNull(),
  createdAt: bigint("createdAt", { mode: "bigint" }).notNull(),
  metadata: text("metadata").notNull(),
});

export const event = pgTable("event", {
  id: text("id").primaryKey(),
  roomId: text("roomId")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  senderId: text("senderId").notNull(),
  type: text("type").notNull(),
  stateKey: text("stateKey"),
  content: text("content").notNull(),
  timestamp: bigint("timestamp", { mode: "bigint" }).notNull(),
  sequenceId: bigint("sequenceId", { mode: "bigint" }).notNull().unique(),
});

export const eventEdge = pgTable("eventEdge", {
  id: text("id").primaryKey(),
  eventId: text("eventId")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  parentEventId: text("parentEventId").notNull(),
});

export const roomState = pgTable("roomState", {
  id: text("id").primaryKey(),
  roomId: text("roomId")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  eventType: text("eventType").notNull(),
  stateKey: text("stateKey").notNull(),
  eventId: text("eventId")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
});

export const sequence = pgTable("sequence", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: bigint("value", { mode: "bigint" }).notNull(),
});
```

Use these examples as a starting point for migrations, then make the adapter
perform any serialization or `bigint`/`number` conversion needed by your
database client.

## License

MIT
