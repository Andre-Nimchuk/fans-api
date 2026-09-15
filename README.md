# Fan Chat

Expo SDK 57 · React Native · TypeScript. Three mock conversations with a shared chat screen. Local mocks require no private credentials or real payments.

**Status:** conversation list, paginated text chat and persistent sending work. A per-chat scenario panel supports write/delivery failures and offline/reconnect. Durable offline restart and the simulated subscription paywall are next.

## Run

Requires Node.js 22.13+ and Yarn Classic 1.22.22. For iOS, install Xcode and boot a simulator.

```sh
nvm use
corepack enable
yarn install --frozen-lockfile
yarn ios
```

Skip `nvm use` / `corepack enable` if the required Node and Yarn versions are already available.

- **iOS:** verified with Expo Go 57.0.9 on iPhone 17 Pro Max Simulator, iOS 26.3.1, development mode. Current dependencies work in Expo Go.
- **Android:** `yarn android` with an emulator or connected device and Android SDK; device behavior untested.
- **Web:** bundle export passes; interactive chat currently requires native SQLite on iOS or Android.

Standalone native builds are untested and require [Xcode 26.4+ for SDK 57](https://docs.expo.dev/versions/v57.0.0/); local Xcode is 26.3.

## Check

```sh
yarn validate    # TypeScript, ESLint, Prettier and tests
yarn test:watch  # Tests during development
yarn format     # Apply formatting
```

**13 storage/scenario tests** against real SQLite files: restart persistence, retry deduplication, ordering/pagination, conflicting IDs, write failure, schema recovery and offline reconciliation. iOS interaction checks cover the keyboard, four-line input limit, sending and separate drafts. Node 22 reports an experimental SQLite warning during tests.

## Try the failure scenarios

Open a chat → **Mock scenarios**. Switches affect this chat and reset on app restart; saved messages remain.

- **Fail next save** → send: text stays in the input; no queued bubble. Send again to save it.
- **Fail next send** → send: saved bubble shows **Not sent → Retry**. Retry keeps the same ID.
- **Go offline** → send three messages → **Add 4 incoming** → **Reconnect**: seven messages are confirmed in server order. **Sync** again adds no copies. Latest sequence numbers are visible in the panel.

Faults fire once; tap an armed fault again to cancel it. This is simulated connectivity, independent of airplane mode.

## Decisions

- Each conversation has separate SQLite files for its client queue and mock server history. Enqueue/accept returns only after persistence; retry with the same client ID returns the original accepted message.
- The mock assigns final order; pending messages retain local order. History loads in pages of 30; the inverted list anchors the latest messages and offers a return button when reading older history.
- `src/features/chat/` owns chat rules, `src/services/mock/` owns mock acceptance, and `src/shared/storage/` owns database access. `tests/` verifies these boundaries. Styles use [NativeWind 4.2.7](https://www.nativewind.dev/docs/getting-started/installation) with shared Tailwind colors.

## Remaining work

Lost-response bug reproduction and red/green regression; full offline/restart/reconnect flow; paywall UI; purchase confirmation tests; 50,000-message profiling and before/after measurements. No performance results are claimed yet.

Final submission will include scenario recordings, measured results, time spent, `AI.md`, and the required brief explanations of store billing, upload recovery and store policies.
