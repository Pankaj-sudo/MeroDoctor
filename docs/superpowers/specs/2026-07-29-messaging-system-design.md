# MeroDoctor Messaging System — V1 Design

Persistent, booking-scoped, real-time messaging as the primary doctor↔patient
channel before / during / after a consultation. Complements (does not replace)
the existing in-call `consultationMessages` chat.

## Data model (Firestore)

### `conversations/{conversationId}` — one per booking (`conversationId === consultationId`)
Structural 1:1 with the consultation; consultation IDs are already access-
controlled, so this also prevents ID guessing.

- `consultationId`, `bookingId` (= id)
- `doctorId`, `patientId`, `participantIds: [patientId, doctorId]`
- `patientName`, `doctorName`
- `status` — denormalized consultation status
- `lastMessage: { text, senderId, senderRole, at, type }` — preview w/o reading messages
- `unread: { [uid]: number }` — per-participant counters
- `lastReadAt: { [uid]: Timestamp }`
- `followUpExpiresAt: Timestamp | null` — set to completed + 7 days
- `createdAt`, `updatedAt`
- `pinnedBy: string[]`, `archivedBy: string[]` — reserved for Stage 2

### `conversations/{id}/messages/{messageId}` — subcollection
- `senderId`, `senderRole` (`patient`|`doctor`), `senderName`
- `type`: `text | prescription | certificate | lab_request | appointment | system | consultation_link | image | pdf | voice`
  (V1 sends only `text` + `system`; the rest are typed-but-stubbed)
- `text`, `meta: Record<string, unknown>`
- `createdAt`
- `deliveredTo: string[]`, `readBy: string[]`
- `deleted: boolean`

### `conversations/{id}/typing/{uid}` — ephemeral presence
`{ uid, at }`; "typing" is shown when the OTHER party's doc is < 5s old.

## Security rules
- **conversation** — read: `signedIn && (uid in participantIds || isStaff)`.
  create: `isStaff` with correct `participantIds`. update: staff full; patient
  may only touch their own `unread`/`lastReadAt`/self pin/archive
  (`affectedKeys().hasOnly`). no client delete.
- **messages** — read: participant of parent (`get()`) or staff. create: sender
  == uid, is participant, AND `parent.followUpExpiresAt == null || request.time <
  followUpExpiresAt` (the read-only-after-follow-up lock). update: only
  `arrayUnion(self)` into `readBy`/`deliveredTo`, or soft-delete own message. no
  edits.
- **typing** — write only by that `uid` if participant; read by participants.

## Follow-up lifecycle
Approve → auto-create conversation. Completed → `followUpExpiresAt = now + 7d`.
After expiry: composer disabled; patient banner "Your complimentary follow-up
period has ended…"; doctor keeps read access; rules block sends regardless of UI.

## Services / hooks / components
- Services: `conversationService`, `messageService`.
- Hooks: `useConversation`, `useMessages`, `useConversations(role)`, `useTyping`,
  `useUnreadTotal`. One deduped listener each, cleaned up on unmount.
- Shared: `MessageThread`, `MessageBubble`, `Composer`, `FollowUpBanner`,
  `TypingIndicator`.
- Patient: `PatientMessagesPanel` (desktop sidebar / tablet slide-over / mobile
  full screen) in `Dashboard`, with unread badge.
- Doctor: `MessagingCenter` at `/doctor/messages` — list + search + filters
  (Today / Active / Completed / Follow-up) + thread; nav entry + unread badge.

## Real-time & performance
`onSnapshot` for conversation/messages/typing; deduped listeners; message
pagination `limit`+`startAfter` (infinite scroll V1, virtualization Stage 2);
previews from `lastMessage` (no message reads for the list).

## Deferred to Stage 2
Pinned/archived UI, message-text search, virtualization, emoji picker, in-app
notifications collection+UI, medical-document sends, real file attachments.

## Integration points
- Route `/doctor/messages`.
- `doctorService.approveForVideoConsultation` → create conversation.
- `doctorService.markCompleted` / `publishPrescription` → set `followUpExpiresAt`.
- Patient `Dashboard` → mount `PatientMessagesPanel`.
