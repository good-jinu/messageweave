---
"messageweave": patch
---

Fix edit/delete target integrity:

- `editMessage` and `deleteMessage` no longer let `content` override `targetMessageId` or other engine-owned fields, so extra metadata cannot redirect an edit or delete to another message.
- `publishEvent` rejects `message.edit` and `message.delete` events unless `content.targetMessageId` is set and equals `parentEventIds[0]`. `beforePublish` hooks can rely on that field as the affected message.
- `projectTimeline` ignores edits and deletes whose target is in a different room or whose `targetMessageId` disagrees with `parentEventIds`.
