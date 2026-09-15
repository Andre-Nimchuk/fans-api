# Source rules

- Keep `app/` routes thin. Put chat rules in `features/chat/`, purchase/access rules in `features/subscription/`, and local service implementations in `services/mock/`. Create these folders when their implementation exists.
- Extract shared code only when it has a real consumer or isolates an external boundary. Avoid generic repository frameworks, DI containers and parallel state stores for this one-screen exercise.
- Domain logic must be testable without rendering React. UI calls use cases; storage, transport and mock-store adapters own their side effects. Client and mock backend communicate through contracts, not each other's persistence internals.
- Use strict TypeScript and explicit state/result types for pending, confirmed and failed outcomes. Avoid `any`, non-null assertions and casts that conceal an unhandled state; explain a necessary boundary exception locally.
- Keep identity, ordering and access decisions out of render functions. Effects subscribe with cleanup; event handlers/use cases initiate user operations. Repeated callbacks, remounts and resets must not duplicate effects.
- Keep transient composer input close to the composer. Do not copy full history into component state or re-sort all messages on every keystroke. Optimize further from measurements.
- Preserve text when persistence or sending fails. Distinguish offline waiting, unknown send outcome and action-required errors in both state and UI.
- Keep reusable visual tokens together and controls accessible. Do not reproduce browser chrome or add nonfunctional feature buttons from reference screenshots.
- Test observable behavior at the relevant boundary. Required regression tests cover lost-response retry, durable restart recovery and delayed paid-access confirmation. Keep broken-demo fixtures isolated from the normal app path and passing suite.
- Comments explain an invariant or tradeoff. Public names and small modules should make routine flow understandable without line-by-line narration.

## Walkthrough markers

- Use a short `// REVIEW: ...` comment at the specific implementation boundary worth explaining in the assignment walkthrough: failure injection, durable enqueue/acceptance, retry deduplication, restart reconciliation, access confirmation or a measured performance fix.
- Explain the non-obvious failure and the guarantee in one or two lines. Add a real test/scenario reference only when useful; keep detailed reproduction steps in tests and the submission README.
- Add markers with the implementation. Do not annotate routine code, repeat the marker across every call site, or treat comments as evidence that a scenario works.
- Keep intentionally broken behavior in an isolated regression fixture/demo path. For each required negative flow, provide a repeatable trigger, an observable expected result and the relevant test or device recording.
