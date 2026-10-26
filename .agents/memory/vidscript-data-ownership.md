---
name: VidScript data ownership
description: Product decision about transcript privacy, account scope, and source-media retention.
---

VidScript.ai uses a signed, HTTP-only guest session cookie to scope each user's transcript library. Uploaded media is processed temporarily, then removed; only transcript records and derived content are stored in PostgreSQL.

**Why:** The initial product was requested as a complete transcription workspace without an account or cross-device-sync requirement. Temporary media handling avoids retaining source video by default.

**How to apply:** Preserve owner scoping on every project read, update, and delete. Add account authentication or persistent video storage only when the user asks for those capabilities.
