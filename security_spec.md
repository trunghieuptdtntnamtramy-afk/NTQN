# Security Specification — EDU SMART Firestore Rules

## 1. Data Invariants
1. **Identity Integrity**: Every document in `users`, `studyTasks`, `thinkEntries`, `factChecks`, `selfTests`, and `surveys` must belong strictly to `request.auth.uid` with a verified email (`request.auth.token.email_verified == true`).
2. **No Self-Assigned Privilege Escalation**: `users/{userId}.role` must strictly be `'student'` on creation and immutable on update.
3. **Immutable Audit & Ownership Fields**: `userId`, `uid`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Strict Key & Size Enforcement**: No shadow/ghost fields allowed (`keys().hasAll(...)` + `keys().hasOnly(...)` on create; `affectedKeys().hasOnly(...)` on update). Every string field has explicit `.size()` bounds matching `firebase-blueprint.json`.
5. **PII Isolation**: `users` documents disallow `list` queries and restrict `get` strictly to the document owner.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unverified Email Write**: Authenticated user with `email_verified: false` creating a `studyTask`.
2. **Identity Spoofing on Create**: User A creating a `studyTask` with `userId: "userB"`.
3. **Shadow / Ghost Field Injection**: Creating a `users/{uid}` document with an extra `isAdmin: true` field.
4. **Role Escalation**: Creating `users/{uid}` with `role: "admin"` instead of `"student"`.
5. **Cross-User Read (`get`)**: User A attempting `get` on `users/userB` or `thinkEntries/entryOwnedByB`.
6. **Blanket Collection Scraping (`list`)**: Attempting `list` on `users` or `studyTasks` without filtering `where("userId", "==", request.auth.uid)`.
7. **ID Poisoning**: Creating a document with a 200-character or special-character document ID (`../admin`).
8. **Denial-of-Wallet Payload Overflow**: Creating a `thinkEntry` with `initialThinking` > 4000 chars.
9. **Client Timestamp Forgery**: Creating a `studyTask` with a backdated client `createdAt` instead of `serverTimestamp()`.
10. **Immortal Field Mutation**: Updating `studyTasks/{id}` to change `userId` or `createdAt`.
11. **Unvalidated Array Poisoning**: Creating a `surveys/{id}` doc with `scores: ["hack", 999]` or length != 5.
12. **Survey Tampering**: Attempting to `update` an existing submitted `surveys/{id}` record.
