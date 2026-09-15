---
name: fans-chat-ui
description: Build or refine the Fans chat and paywall visuals, keyboard/accessibility behavior, paginated message list and measured scroll performance using the supplied mobile references.
---

# Chat UI and performance

All paths below are repository-relative. Read `.local/design/README.md` and relevant UI/PERF requirements in `.local/task/01-requirements.md`. Inspect the referenced image files when present; do not claim access to originals that are still missing.

## Build the assigned screen

- Use reference 3 chat as the working baseline: light surfaces, gray/lavender bubbles, compact header, purple actions and bottom composer. Extend the same language to paywall and failure states.
- Implement the written chat/paywall scope. Do not add list/profile/PPV/media/gift flows or fake browser chrome just because they appear in the references.
- Preserve text and readable waiting/error/confirmation status. Verify keyboard, native safe areas, accessible controls and reduced motion on the chosen platform.
- Use stable row identity and deliberate scroll anchoring. Pagination must limit client work; virtualizing rows alone does not justify loading all 50 000 records or rebuilding the thread on keystrokes.

For profiling, read only the performance protocol in `.local/task/04-delivery.md`. Capture baseline before a targeted optimization and repeat the same history/sequence/device/build afterward. Report actual frame and memory metrics, tools and limitations; do not call a suspected bottleneck measured evidence.

For a visual-only change, perform the relevant visual check. Add behavioral tests only where state or interaction correctness changed.
