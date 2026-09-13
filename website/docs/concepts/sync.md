---
id: sync
title: Real-time Sync
sidebar_position: 3
---

# Real-time Sync

MessageWeave makes real-time synchronization trivial with a single, globally
**monotonically increasing `sequenceId`**. Every published event — across every
room — is assigned the next number in this global sequence.

## A single global cursor

Because the sequence is global and strictly increasing, a client only needs to
remember **one number**: the `sequenceId` of the last event it has seen. To
catch up, it asks for everything after that cursor:

```ts
let cursor = 0;

const { events, nextToken } = await flow.getSyncStream({
  sinceSequenceId: cursor,
  limit: 100,
});

// Apply `events` (oldest-first), then advance the cursor:
cursor = nextToken;
```

Poll `getSyncStream` on an interval, or trigger it from your own
push/WebSocket layer — MessageWeave is transport-agnostic, so *how* you deliver the
stream to clients is up to you.

## Real-time streaming with `subscribe`

In addition to polling `getSyncStream`, MessageWeave provides an async iterable stream
via `flow.subscribe()`:

```ts
// Stream live events with automatic catch-up and abort support
const controller = new AbortController();

const stream = flow.subscribe({
  roomId: room.id,
  sinceSequenceId: cursor, // fetches missed events first, then streams live events
  signal: controller.signal,
});

for await (const event of stream) {
  sendToClient(event);
}
```

`flow.subscribe()` guarantees gapless and duplicate-free delivery across the transition
from historical events to live events. It works out-of-the-box with Server-Sent Events (SSE),
WebSockets, and Edge runtime workers.

## In-process event listener with `onEvent`

For direct in-process notifications (e.g. broadcasting to local WebSocket connections):

```ts
const unsubscribe = flow.onEvent((event, context) => {
  wsServer.to(event.roomId).emit("event", event);
});

// Later, cleanup:
unsubscribe();
```

## Scaling across multiple nodes (`PubSubAdapter`)

By default, in-memory pub/sub handles live events on a single node. For distributed
deployments across multiple processes or containers, supply a `PubSubAdapter` (such as
Redis or PostgreSQL LISTEN/NOTIFY) when creating the engine:

```ts
const flow = createMessageWeave({
  storage,
  pubsub: myRedisPubSubAdapter,
});
```

## How the sequence stays monotonic

MessageWeave's storage contract exposes no transaction primitive, so MessageWeave
serializes `publishEvent` in-process to keep concurrent publishes from racing
inside one engine instance. Integrity checks run before sequence assignment, but
storage failures during a serialized write can still advance the stored counter.
For multi-process publishers or stronger atomicity guarantees, use a storage
implementation that provides atomic ordering.


:::tip
Persist the cursor per-client. On reconnect, replay from the stored
`sequenceId` and the client is fully caught up — no per-room bookkeeping
required.
:::
