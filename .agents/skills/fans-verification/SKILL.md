---
name: fans-verification
description: Review Fans assignment acceptance, collect regression/demo/performance evidence, or prepare the final README, AI.md and ZIP. Use for milestone verification and handoff, not every routine edit.
---

# Verify and hand off

All paths below are repository-relative. Read `.local/task/01-requirements.md` and the relevant scenarios in `03-verification.md`. For final delivery, read `04-delivery.md` and the original submission section.

## Evidence before completion

- Associate each reviewed requirement with code/test/artifact paths and an actual result. Distinguish automated logic tests, device recordings and performance measurements.
- Required focused evidence: duplicate bug red/green, durable restart recovery, delayed backend confirmation. The final normal test command must pass; the expected failing broken fixture needs its own documented invocation.
- Recovery recordings must be uncut and include real force-quit/force-stop. Reload, remount and backgrounding are different operations.
- Performance evidence needs repeatable 50 000-message history, same-sequence before/after, device/OS/build/tool details, frame timing or dropped frames and memory. Mark unavailable metrics honestly.
- Keep README and AI.md short and factual: decisions, exact commands/results, platform limits, time, unfinished work and concrete AI output checked/corrected. Verify current official sources for billing, upload lifecycle and store-policy explanations.
- Check the ZIP contains runnable source, lockfile, instructions, tests and accessible recordings; exclude `.local/`, caches and credentials explicitly. Verify the extracted exercise without private credentials.

Report unmet requirements as gaps, not successes. Preparing the submission does not authorize publishing a link or sending email; use the user's existing authorization for any external action.
