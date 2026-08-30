---
"messageweave": minor
---

Add message edit and delete support and timeline projection helper:

- Add `editMessage()` to `ChatCore` to publish immutable `message.edit` revision events.
- Add `deleteMessage()` to `ChatCore` to publish immutable `message.delete` tombstone events.
- Export `projectTimeline()` utility to fold event streams (revisions and deletions) into UI-ready `ProjectedMessage` models.
- Export `EditMessageInput`, `DeleteMessageInput`, `ProjectedMessage`, and `ProjectTimelineOptions` types.
