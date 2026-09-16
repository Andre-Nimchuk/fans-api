# Fan Chat

Expo SDK 57 · React Native · TypeScript. Three mock conversations with a shared chat screen. Local mocks require no private credentials or real payments.

**Status:** conversation list, paginated text chat and persistent sending work. Durable offline restart, lost-response retry and per-chat demo reset are implemented. Simulated billing, delayed access confirmation and restoration are implemented. Performance profiling is next.

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

**31 focused tests** use real SQLite files. `tests/storage/` covers persistence and migrations, `tests/chat/` covers delivery/restart/sync, and `tests/subscription/` covers purchase/restore/access. Shared setup lives in `tests/helpers/`; scenario steps and assertions stay in each test. Node 22 reports an experimental SQLite warning.

Earlier iOS checks cover chat interactions and the paywall's initial layout. Full recovery/billing recordings remain pending.

## Try the failure scenarios

First confirm All Access (below), then open a chat → **Mock scenarios**. Controls affect this chat only. Offline mode, pending messages and received history survive app restart.

- **Fail next save** → send: text stays in the input; no queued bubble. Send again to save it.
- **Fail next send** → send: saved bubble shows **Not sent → Retry**. Retry keeps the same ID.
- **Go offline** → send three messages → force-quit/reopen (all three still **Waiting**) → **Add 4 incoming** → **Reconnect**: seven messages are confirmed in server order. **Sync** again adds no copies. Latest sequence numbers are visible in the panel.

- **Lose next response** → send: the server saves it, but the bubble shows **Not confirmed**. **Retry** returns the original acceptance, producing one copy.
- **Reset demo** → confirm: restore this chat's 42 sample messages, clear its queue/cache/draft and return online. An interrupted reset completes at startup.

`yarn demo:duplicate` intentionally fails with `2 !== 1`: the isolated broken client creates a new ID after a lost response. The passing regression uses the original ID. This fixture is excluded from `yarn validate`.

Faults fire once; tap an armed fault again to cancel it. This is simulated connectivity, independent of airplane mode.

## Simulated billing

Open **Get All Access** in a chat. Reading stays free; confirmed access permits sends in all three chats. Demo price: $9.99/month (30 days, no automatic renewal or real charges).

- **Subscribe** → confirmation pending (sending still locked) → **Complete backend confirmation** → access active. Closing/reopening the app preserves the purchase and pending confirmation.
- **Billing scenarios → Cancel / Fail** → purchase: distinct outcomes; an existing valid subscription stays active. The selected outcome fires once. Concurrent purchase/restore taps are guarded in the model.
- **Reset billing → Seed existing store purchase → Restore purchases → Complete backend confirmation** demonstrates restoration. Restore after an empty reset reports no purchase.
- **Replay last event** neither extends expiry nor grants unconfirmed access while confirmation is held. **Expire access / Refund** revoke sending; replay/restore cannot reactivate that transaction. Billing reset affects all three chats, preserving messages and drafts.

Store transactions and backend confirmations occupy separate tables. The backend looks up the original transaction and uses its authoritative expiry; confirmation inserts are idempotent by transaction ID. Offline enqueue uses the last confirmed, unexpired access. Delivery checks access again; blocked queued messages retain their IDs/text. After renewing, use **Retry** or **Sync**. Billing controls are independent of the per-chat offline simulation.

For production, replace the mock purchase adapter with StoreKit / Google Play Billing, use store-provided localized products/prices, and associate transactions with the authenticated account. Verify signed Apple transactions or Play purchase tokens on the backend before granting access, then finish/acknowledge purchases appropriately. Reconcile renewals, expiry and refunds through server notifications plus store API checks, processing duplicate events idempotently; enforce paid sends on the real server too. See [Apple transactions](https://developer.apple.com/documentation/storekit/transaction), [App Store Server Notifications](https://developer.apple.com/documentation/appstoreservernotifications) and [Google Play backend integration](https://developer.android.com/google/play/billing/backend).

## Decisions

- Each conversation has separate SQLite files for its queue, received-history cache/settings and mock server history. Enqueue/accept returns only after persistence; retry with the same client ID returns the original accepted message.
- Cache writes precede cursor advancement and queue cleanup; replay after interruption is idempotent. Reset is serialized with delivery and has a durable completion marker.
- The mock assigns final order; pending messages retain local order. History loads in pages of 30; the inverted list anchors the latest messages and offers a return button when reading older history.
- `src/bootstrap/` connects chat, subscription and native persistence. Features own their UI and rules. `src/features/chat/model/` separates delivery coordination (`thread-store`) from message identity/order (`thread-messages`); `data/` wires persistence, `hooks/` handles interactions, and `components/` renders UI. `src/services/mock/` owns mock acceptance, and `src/shared/storage/` owns database access. `tests/` verifies these boundaries. Styles use [NativeWind 4.2.7](https://www.nativewind.dev/docs/getting-started/installation) with shared Tailwind colors.

## Remaining work

Uncut device recovery/billing recordings; 50,000-message profiling and before/after measurements. The paywall opens on the iOS simulator; the full native billing walkthrough is still pending. No performance results are claimed yet.

Final submission will include scenario recordings, measured results, time spent, `AI.md`, and the required brief explanations of store billing, upload recovery and store policies.
