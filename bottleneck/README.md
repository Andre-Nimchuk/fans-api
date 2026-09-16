# Chat performance: before / after

## Setup and artifacts

- **Target:** iPhone 17 Pro Max Simulator, iOS 26.3.1 (reported test setup).
- **Runtime:** Expo Go, Expo SDK 57, React Native 0.86.3, Hermes, development mode. The traces confirm iOS/development/Hermes; device and OS details are not embedded in the exports.
- **Tools:** React Native DevTools Performance for capture; Python for JSON parsing and metric aggregation; Codex for assisted analysis.
- **Workload:** 50,000 mock messages, 20-message pages, scroll + typing + send. Both traces contain ten page additions and one outgoing message: 20 initial + 200 older + 1 sent = **221 loaded**.
- **Evidence:** [before-scroll-01.json](./before-scroll-01.json) — 103.97 s; [after-scroll-01.json](./after-scroll-01.json) — 101.82 s. Original exports are preserved.

## Bottleneck and change

Pagination recreated list callbacks and configuration objects, causing updates to existing cells whose message data had not changed. The baseline recorded **716 CellRenderer updates involving only ref/renderItem identity changes**. A full-thread subscription also propagated pagination updates to the screen and unrelated controls.

The fix:

- Subscribe the list only to the message array; give loading/error components independent subscriptions.
- Stabilize item rendering, key extraction, scroll callbacks, styles, list configuration and the footer element.
- Subscribe the screen only to the reset revision and the composer to the reset flag; stabilize send/reset callbacks.

Implementation: [message-list.tsx](../src/features/chat/components/message-list.tsx), [message-list-status.tsx](../src/features/chat/components/message-list-status.tsx), [use-message-scroll.ts](../src/features/chat/hooks/use-message-scroll.ts), [chat-screen.tsx](../src/features/chat/screens/chat-screen.tsx), [composer.tsx](../src/features/chat/components/composer.tsx).

Seed, page size, SQLite behavior and virtualization settings stayed unchanged. Message/status/day-boundary/access updates remain reactive. **Validation:** `yarn validate` passed all 35 tests; the updated chat passed a simulator launch/layout smoke check.

## Results

| Metric                                             |   Before |    After |
| -------------------------------------------------- | -------: | -------: |
| React Render p95                                   | 19.30 ms | 15.42 ms |
| Longest React Render                               | 46.07 ms | 23.77 ms |
| Render intervals >16.67 ms                         |       42 |       24 |
| CellRenderer updates: ref/renderItem identity only |      716 |      394 |
| FlatList updates without changed data              |       13 |        1 |
| Composer updates: onSent identity only             |       23 |        0 |
| ScenarioPanel updates: onReset identity only       |       23 |        0 |
| Total React Render intervals                       |      498 |      540 |
| Longest Remaining Effects interval                 | 34.90 ms | 55.35 ms |

**Method:** React Scheduler Blocking intervals, microseconds converted to milliseconds; nearest-rank p95. Update counts come from component changed-props records. Nested component timings are not summed.

**Conclusion:** targeted update propagation decreased. Ref/renderItem-only cell updates fell **45.0%**, and Render p95 fell **20.1% in this pair of runs**. Callback-only updates to the composer and scenario panel disappeared. Remaining cell updates include list-internal identity changes; expensive work was reduced, not eliminated.

## Limits and remaining evidence

- One before/after pair with matched data volume but different interaction cadence. After includes seven scenario-panel toggle updates versus none before, and 381 internal list-window updates versus 341. Total Render count and maximum Remaining Effects increased. These results support the targeted fix, not an application-wide speedup claim.
- Development/profiling overhead is included. Simulator results do not establish physical-device performance.
- **Frame timing/dropped frames and memory usage remain unmeasured.** React Render duration is not frame-presentation timing; 16.67 ms is a 60 Hz reference threshold. Neither export contains native frame or memory measurements.
- For a stricter repeat: reset the same chat, keep the scenario panel closed during capture, match gestures/input and final loaded count, and repeat before/after runs. Capture native frame and memory metrics separately.

## AI assistance

Codex assisted with Python-based trace parsing, metric calculations, changed-props analysis and comparison with the implementation. The figures above were calculated from the linked exports. AI-assisted analysis guided the fix; improvement claims are limited to the measurements and caveats documented here.
