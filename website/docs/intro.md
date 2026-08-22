---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# MessageWeave

**MessageWeave** is an in-process, database-agnostic, **event-sourced** messaging
engine for TypeScript. It provides the core logical engine for chat
applications — the transport layer (HTTP, WebSockets, gRPC) and the storage
engine are left entirely in your hands.

## Why MessageWeave

- **Database agnostic** — use the built-in Drizzle, Prisma, Kysely, Knex,
  MongoDB, or Sumak entry point, or supply your own ChatCore storage backend.
- **Immutable event sourcing** — every action in a room (a message, an edit, a
  membership or topic change) is an immutable `FlowEvent`.
- **Trivial real-time sync** — a single, monotonically increasing `sequenceId`
  drives global synchronization.
- **Threaded DAG** — edges between events enable replies and branching
  timelines.

## How it fits together

ChatCore is just the engine. You bring:

1. **A database** — connect Drizzle, Prisma, Kysely, Knex, MongoDB, or Sumak
   through MessageWeave's database-specific entry points. You can also
   implement `ChatCoreStorage` for another persistence layer.
2. **A transport** — expose the engine's methods over HTTP, WebSockets, gRPC,
   or anything else.

The engine handles the hard parts: immutable event storage, room state
reduction, threaded timelines, and a single global cursor for real-time sync.

Continue to **[Getting Started](./getting-started.md)** to install MessageWeave and
publish your first event, or jump straight to the
**[API Reference](./api/index.md)**.
