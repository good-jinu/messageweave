---
id: attachments
title: Attachments & Media
sidebar_position: 4
---

# Attachments & Media

MessageWeave synchronizes portable attachment references, not binary file data.
The host application owns file upload, storage, authorization, delivery, and deletion.

## Host-owned attachment model

Instead of bloating event payloads with file bytes or vendor-specific cloud credentials,
MessageWeave uses a host-owned reference pattern:

1. **Host completes & verifies the upload**: The client uploads media directly to your object
   storage (S3, Cloudflare R2, GCS, CDN, or local disk).
2. **Publish lightweight metadata**: Store only an opaque `id` and presentation metadata in
   the event content using `AttachmentReference`.
3. **Host authorizes access**: When clients request or render the attachment, your application
   authorizes and resolves the opaque ID into a temporary signed URL or direct stream.

```ts
import type { AttachmentReference } from "messageweave";

// Issued by your host application after verifying the upload:
const attachment: AttachmentReference = {
  id: "att_01JABCDEF",
  kind: "image",
  name: "photo.png",
  mimeType: "image/png",
  size: 483_920,
  width: 1920,
  height: 1080,
};

await flow.publishEvent({
  roomId: room.id,
  senderId: "u1",
  type: "message.media",
  content: {
    body: "Check out this screenshot",
    attachments: [attachment],
  },
});
```

## Supported attachment kinds

`AttachmentReference` supports four presentation categories:
- `"image"`
- `"video"`
- `"audio"`
- `"file"`

Optional attributes like `durationMs` (for audio/video) and `width` / `height` (for visual media)
allow clients to reserve layout space and render rich players before media bytes download.

## Best practices

- **Never store credentials or permanent signed URLs in event content**: Events are immutable.
  Permanent signed URLs can expire or leak credentials permanently into event history.
- **Enforce quotas and virus scanning before publishing**: Validate media size and MIME types
  in your host upload handler or in MessageWeave's `beforePublish` hook.
- **Handle deletions in your host app**: When a message is deleted (via `flow.deleteMessage`),
  you can schedule cleanup of underlying objects in object storage using an `onPublish` hook.
