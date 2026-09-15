# Fan Chat

Expo SDK 57 · React Native · TypeScript. One chat and a simulated subscription paywall, using local mocks without private credentials or real payments.

**Status:** message storage is implemented; the main screen is still empty. Chat UI, delivery/recovery and payments are next.

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
- **Web:** `yarn web` for a preview; native storage checks require iOS or Android.

Standalone native builds are untested and require [Xcode 26.4+ for SDK 57](https://docs.expo.dev/versions/v57.0.0/); local Xcode is 26.3.

## Check

```sh
yarn validate    # TypeScript, ESLint, Prettier and tests
yarn test:watch  # Tests during development
yarn format     # Apply formatting
```

**8 storage tests pass** against real SQLite files: restart persistence, retry deduplication, ordering/pagination, conflicting IDs, write failure and schema recovery. The native diagnostic also preserved three queued messages and one accepted record after terminating and reopening Expo Go. Node 22 reports an experimental SQLite warning during tests.

## Decisions

- Separate SQLite files hold the client queue and mock server history. Enqueue/accept returns only after persistence; retry with the same client ID returns the original accepted message.
- The mock assigns final order; pending messages retain local order.
- `src/features/chat/` owns chat rules, `src/services/mock/` owns mock acceptance, and `src/shared/storage/` owns database access. `tests/` verifies these boundaries; `src/dev/` contains the native diagnostic.

## Remaining work

Lost-response bug reproduction and red/green regression; full offline/restart/reconnect flow; chat and paywall UI; purchase confirmation tests; 50,000-message profiling and before/after measurements. No performance results are claimed yet.

Final submission will include scenario recordings, measured results, time spent, `AI.md`, and the required brief explanations of store billing, upload recovery and store policies.
