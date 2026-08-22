# RFC 0002 — Feature Recommendations & Analysis for MessageWeave

- **Status:** Proposed
- **Target version:** 0.3.0+
- **Scope:** Engine Architecture, Feature Gaps, and Low-Level Primitives

---

## 1. Executive Summary & Current Capabilities Evaluation

### 1.1 Is MessageWeave enough as a chat app business logic provider?

**Verdict:** MessageWeave provides an exceptionally strong **foundation** as an in-process, database-agnostic, event-sourced messaging engine. Its current core architecture excels at:
- **Immutable Timeline Integrity:** Every message or configuration change is an immutable `FlowEvent` ordered by a single monotonically increasing `sequenceId`.
- **Transport & Storage Decoupling:** Complete separation from transport protocols (HTTP, WebSockets, gRPC) and storage engines (Drizzle, Prisma, Kysely, MongoDB, etc.).
- **DAG Threading Primitives:** Built-in parent-child event linking (`parentEventIds`) allowing flexible replies and threaded conversation branches.
- **State Projections:** Native support for "state events" (`stateKey`) to model room-level durable state alongside timeline traffic.
- **Host-Owned Media:** Portable attachment references (`AttachmentReference`) keeping host storage/auth cleanly separated from message event traffic.
- **Scoped Synchronization:** Scoped sync streams (`getSyncStream({ roomIds })`) allowing efficient multi-room real-time sync.

However, when evaluating MessageWeave against the requirements of enterprise/team messaging systems (Slack, Discord, Teams) or general chat applications, **MessageWeave currently lacks explicit primitives and conventions for essential chat lifecycle operations**, specifically:
1. **Message Revision & Deletion (Edit/Delete)**: No standardized event-sourcing semantics for message updates or tombstones.
2. **Moderation & Search Hooks**: No middleware or event-lifecycle hooks for content inspection, moderation, or external index updates (e.g. Elasticsearch, Meilisearch).
3. **Common Presentation Projections**: No built-in helpers to fold/project raw event streams (including edits, reactions, and deletions) into UI-ready message models.

---

## 2. Core Recommendations

MessageWeave must strictly remain a **low-level event engine mechanism**, leaving auth, business policy, and storage implementation to the host application. The following recommendations introduce high-value chat capabilities through low-level engine primitives and helper utilities.

---

### Recommendation 1: Event-Sourced Message Edit & Delete Handling

In an event-sourced chat engine, past events are never mutated or physically deleted in storage. Instead, modifications and deletions are published as new `FlowEvent` entries referencing the target event.

#### 1. Standardized Event Specification

MessageWeave should define standard dot-notated event conventions and helper constructors:

* **Message Edit Event (`message.edit` / `message.update`)**:
  ```ts
  {
    type: "message.edit",
    roomId: "room_123",
    senderId: "user_abc",
    parentEventIds: ["target_msg_id"], // Links to the original message
    content: {
      body: "Updated message body text",
      editedAt: 1715000000000
    }
  }
  ```

* **Message Delete / Tombstone Event (`message.delete`)**:
  ```ts
  {
    type: "message.delete",
    roomId: "room_123",
    senderId: "user_abc",
    parentEventIds: ["target_msg_id"],
    content: {
      reason: "Deleted by user", // Optional host metadata
      tombstone: true
    }
  }
  ```

#### 2. Projection & Folding Helper Utilities

To prevent every host application from re-implementing event-folding logic for presentation, MessageWeave should provide lightweight, pure projection functions in `messageweave/utils`:

```ts
import { projectTimeline, PublishedMessage } from "messageweave/utils";

// Folds raw FlowEvents (messages, edits, deletes, reactions) into UI-ready message views:
const projectedMessages: PublishedMessage[] = projectTimeline(rawEvents);
```

#### 3. Engine-Level Support in `getRoomTimeline`

Add projection options to timeline reads:

```ts
interface GetTimelineOptions {
  limit?: number;
  beforeSequenceId?: number;
  /**
   * When true (default), folds revisions (`message.edit`) and tombstones (`message.delete`)
   * into their target messages.
   * When false, returns raw immutable FlowEvent entries.
   */
  projectRevisions?: boolean;
}
```

---

### Recommendation 2: Moderation & Search Pipeline Hooks

Enterprise and team chat apps require real-time content moderation (blocking profanity, DLP scan, spam detection) and fast full-text search indexing across rooms.

#### 1. Publish Middleware / Lifecycle Hooks

Introduce `beforePublish` and `afterPublish` interceptors to `ChatCoreOptions`:

```ts
const flow = createChatCore({
  storage,
  hooks: {
    /**
     * Synchronous/blocking hook executed before sequence assignment.
     * Host can inspect content, reject publication by throwing a ChatCoreError,
     * or modify content payload (e.g., auto-redacting sensitive patterns).
     */
    beforePublish: async ({ event, room }) => {
      if (containsForbiddenTerms(event.content)) {
        throw new ChatCoreError("MODERATION_REJECTED", "Message blocked by policy");
      }
    },

    /**
     * Asynchronous post-commit hook executed after storage transaction completes.
     * Ideal for triggering external search indexing (Elasticsearch, Meilisearch)
     * or async push notifications without delaying sequence assignment.
     */
    afterPublish: async ({ event, sequenceId }) => {
      await searchIndexer.indexEvent(event);
    }
  }
});
```

#### 2. Search Integration & Query Primitives

Since ChatCore delegates storage to DB adapters via Unadapter:
- Host apps can index events via `afterPublish` into external search engines.
- Add an optional `searchEvents` method to `ChatCoreStorage` interface for storage backends that natively support full-text search (e.g., PostgreSQL `tsvector` or MongoDB text indexes):

```ts
interface SearchEventsOptions {
  roomIds?: string[];
  query: string;
  limit?: number;
}

// Low-level search pass-through:
const results = await flow.searchEvents({
  roomIds: ["room_1", "room_2"],
  query: "quarterly report",
  limit: 20
});
```

---

### Recommendation 3: Low-Level Primitives for Complementary Features

To complete enterprise chat requirements while adhering to the "mechanism, not policy" principle, MessageWeave can standardize state event keying patterns for common capabilities:

#### 1. Read Receipts & Unread Counts
- **State Key Pattern**: `type: "room.read_cursor"`, `stateKey: senderId`
- **Payload**: `{ lastReadSequenceId: 1045, timestamp: 1715000000000 }`
- Host applications can calculate unread badge counts by comparing `room.read_cursor` `lastReadSequenceId` against the room's latest `sequenceId`.

#### 2. Message Reactions & Idempotent State
- **Event Pattern**: `type: "message.reaction"`, `parentEventIds: ["target_msg_id"]`
- **Payload**: `{ emoji: "👍", action: "add" | "remove" }`
- Pure timeline folding helpers (`projectTimeline`) automatically compute emoji counts and user reaction lists per message.

#### 3. Room Membership & Metadata State Events
- **State Key Pattern**: `type: "room.member"`, `stateKey: userId`
- **Payload**: `{ role: "member" | "admin", joinedAt: 1715000000000 }`
- Allows querying active room state without imposing any specific RBAC or permission rules inside MessageWeave.

---

## 3. Roadmap & Implementation Matrix

| Feature | Category | Altitude in MessageWeave | Release Target |
| :--- | :--- | :--- | :--- |
| **Publish Lifecycle Hooks (`beforePublish`, `afterPublish`)** | Engine Architecture | Core `ChatCoreOptions` | v0.3.0 |
| **Message Edit & Delete Semantics** | Core Chat Logic | Event Types & Projections | v0.3.0 |
| **`projectTimeline` Helper Utility** | Presentation Primitive | `messageweave/utils` export | v0.3.0 |
| **`searchEvents` Storage Pass-through** | Search Primitive | Optional `ChatCoreStorage` method | v0.4.0 |
| **Read Receipt & Reaction Conventions** | Specification & Docs | RFC Standards / Examples | v0.4.0 |

---

## 4. Conclusion

MessageWeave is well-positioned as a lightweight, database-agnostic messaging engine. By adding **event edit/delete projection conventions** and **interceptor hooks for moderation and search**, MessageWeave will provide complete low-level business logic coverage for enterprise team messaging and conversational applications while maintaining its clean, policy-agnostic architectural boundary.
