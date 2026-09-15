# Fan Chat

Expo SDK 57, React Native and TypeScript. The starter demos have been removed; the app currently opens an empty screen. Chat and simulated subscriptions are not implemented yet.

## Setup

Use Node.js 22.13 or newer and Yarn Classic 1.22.22. The repository includes an `.nvmrc` for Node 22.

```sh
nvm use
corepack enable
yarn install --frozen-lockfile
yarn start
```

`nvm use` is optional if a compatible Node version is already installed. `corepack enable` enables the package-manager shim; skip it if Yarn 1.22.22 is already available.

## Run

- `yarn ios` — start Expo and open an installed iOS simulator (macOS with Xcode).
- `yarn android` — start Expo and open an Android emulator or connected device (Android SDK required).
- `yarn web` — browser preview.

Native simulator/device behavior has not been verified yet. Choose and record the demo device and OS during implementation. If added native dependencies require a development build, update these instructions with the verified build steps.

## Quality checks

```sh
yarn validate
```

This runs TypeScript, ESLint with zero warnings, and Prettier's formatting check without changing files.

| Command             | Purpose                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| `yarn typecheck`    | Strict TypeScript checks, including indexed access and unused code              |
| `yarn lint`         | Expo ESLint rules plus type imports, explicit-any and non-null assertion checks |
| `yarn lint:fix`     | Apply available ESLint fixes                                                    |
| `yarn format`       | Format application code, configuration and project documentation                |
| `yarn format:check` | Check formatting without writing                                                |

VS Code recommendations enable ESLint fixes and Prettier formatting on save with the workspace TypeScript version. Local task notes, agent instructions and generated files are excluded from bulk formatting.

ESLint uses the [Expo flat configuration](https://docs.expo.dev/guides/using-eslint/); Prettier runs separately with [conflicting lint rules disabled](https://prettier.io/docs/integrating-with-linters).

ESLint is kept on 9.x for compatibility with the React plugin shipped by the SDK 57 preset. Its upstream support has ended; revisit the version when that preset supports ESLint 10. The combined script is named `validate` because `check` is a built-in Yarn Classic command.

## Source layout

- `src/app/_layout.tsx` — root navigation and status bar.
- `src/app/index.tsx` — entry route for the chat.

Feature and service modules will be added with their implementation. Behavioral tests will accompany the message-recovery and paid-access logic; there is no test suite yet.
