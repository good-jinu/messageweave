# MessageWeave

An in-process, database-agnostic, **event-sourced** messaging engine for
TypeScript. MessageWeave provides the core logical engine for chat
applications — the transport layer (HTTP, WebSockets, gRPC) and the storage
engine are left entirely in your hands.

- **Database agnostic** — all persistence is delegated to a small
  `ChatCoreStorage` backend you supply.
- **Immutable event sourcing** — every action in a room (a message, an edit, a
  membership or topic change) is an immutable `FlowEvent`.
- **Trivial real-time sync** — a single, monotonically increasing `sequenceId`
  drives global synchronization.
- **Threaded DAG** — edges between events enable replies and branching timelines.
- **Host-owned attachments** — events can carry portable attachment references
  while the host application owns file storage, authorization, and delivery.

## Install

```bash
pnpm add messageweave
```

## Quick start

```ts
import { getTestInstance } from "messageweave/test";

const { flow } = getTestInstance();

const room = await flow.createRoom({ creatorId: "u1", metadata: { name: "general" } });

await flow.publishEvent({
  roomId: room.id,
  senderId: "u1",
  type: "message.text",
  content: { body: "hello" },
});

// Drive real-time sync from a single global cursor:
const { events, nextToken } = await flow.getSyncStream({ sinceSequenceId: 0 });
```

For production, use one of MessageWeave's optional database entry points:

```ts
import { createChatCore } from "messageweave";
import { drizzleStorage } from "messageweave/drizzle";

const flow = createChatCore({
  storage: drizzleStorage(db, {
    provider: "pg",
    schema,
  }),
});
```

Equivalent entry points are available for Prisma, Kysely, Knex, MongoDB, and
Sumak. Applications can also provide a custom `ChatCoreStorage` implementation.
Unadapter powers the built-in integrations internally but is not part of
application code.

Generate starter SQL for ChatCore's storage tables with the separate CLI
package:

```bash
pnpm dlx @messageweave/cli schema generate --dialect sqlite --out migrations/001_chatcore.sql
```

For media and attachments, keep event payloads small and store only opaque,
host-issued attachment references. ChatCore synchronizes the references; the
host application owns upload, storage, authorization, delivery, and deletion:

```ts
import type { AttachmentReference } from "messageweave";

// Issued after the host application completes and verifies an upload.
const attachment = {
  id: "att_01JABCDEF",
  kind: "image",
  name: "image.png",
  mimeType: "image/png",
  size: 483_920,
  width: 1920,
  height: 1080,
} satisfies AttachmentReference;

await flow.publishEvent({
  roomId: room.id,
  senderId: "u1",
  type: "message.media",
  content: { body: "hello", attachments: [attachment] },
});
```

Do not put object-store keys, credentials, or permanent signed URLs in event
content. Resolve the opaque attachment id through the host application when a
client needs to upload or download the underlying file.

## API reference

The complete API reference is generated from the source TSDoc on every docs
build. See the [MessageWeave API reference](https://good-jinu.github.io/messageweave/api/)
for current functions, types, and adapter options.

## Development

This is a pnpm monorepo. The SDK lives in `packages/messageweave`.

```bash
pnpm install
pnpm typecheck
pnpm test
```

See [`AGENTS.md`](./AGENTS.md) for contributor guidelines.

## License

MIT
