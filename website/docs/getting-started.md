---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

## Install

```bash
pnpm add messageweave
```

## Quick start

```ts
import { getTestInstance } from "messageweave/test";

const { flow } = getTestInstance();

const room = await flow.createRoom({
	creatorId: "u1",
	metadata: { name: "general" },
});

await flow.sendMessage({
	roomId: room.id,
	senderId: "u1",
	body: "hello",
});

// Drive real-time sync from a single global cursor:
const { events, nextToken } = await flow.getSyncStream({ sinceSequenceId: 0 });
```

:::note Production storage
For production, use a database-specific storage entry point such as
`messageweave/drizzle` or `messageweave/prisma`. Unadapter powers these entry
points internally, but application code does not import or configure it. See
**[Database Adapters](./database-adapters.md)** for setup examples.
:::

## Testing helper

```ts
import { getTestInstance } from "messageweave/test";

const { flow, db } = getTestInstance();
// `flow` is a ChatCore engine, `db` is the raw in-memory store for assertions.
```

## API reference

The **[API Reference](./api/index.md)** is generated directly from MessageWeave's
source TSDoc before every docs build, so it always reflects the exported
functions, types, and adapter options.
