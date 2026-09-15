---
name: fans-chat-recovery
description: Implement or debug durable chat sends, retry deduplication, restart recovery, ordering and sync in the Fans exercise. Use for message correctness changes, not purely visual chat styling.
---

# Chat recovery

All paths below are repository-relative. Read MSG rows in `.local/task/01-requirements.md`, the matching original spec section, and only the relevant messaging section of `02-architecture.md` or `03-verification.md`.

## Work from the failure boundary

1. Identify where the outcome becomes durable: client enqueue, server acceptance, client confirmation or incoming cursor advance. State what a crash at that boundary must recover.
2. For duplicate-send work, reproduce server commit followed by response loss before fixing it. A throw before server acceptance tests a different failure.
3. Preserve one client ID per logical send across retries/restarts. Server acceptance and dedup information persist independently from the client queue; concurrent retries resolve to the same server record.
4. Do not label a send queued before durable enqueue. Reconcile acknowledgments, sync and overlapping pages by identity; server controls final order, pending messages retain local order.
5. Run focused tests for changed boundaries. Restart coverage must reopen persistence with fresh client/server instances; record a real device force-quit separately. Keep expected-broken reproduction isolated from the passing suite.

Use TEST-01–04 and DEMO-01–04 as applicable. Report the requirement IDs, crash/failure reproduced, test command/result and remaining device verification. Update the checkpoint once the slice is complete.
