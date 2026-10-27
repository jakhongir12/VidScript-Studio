---
name: VidScript data ownership
description: Product decision about transcript privacy, account scope, and source-media retention.
---

VidScript.ai scopes transcript projects to the authenticated Clerk user. On sign-in or registration, projects from that browser's signed guest session are claimed by the account; projects remain private to that owner. Uploaded media is processed temporarily, then removed; only transcripts and derived content are stored in PostgreSQL.

**Why:** Account creation was added after the original guest-only workflow. Claiming the current guest session's projects preserves existing work without allowing a user to claim another browser's library.

**How to apply:** Keep every project read, update, delete, and guest-library transfer owner-scoped. Use the authenticated Clerk ID for signed-in projects, and keep source uploads temporary unless the user explicitly requests persistent media storage.
