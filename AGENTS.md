# Fans chat — working instructions

## Start with the task

- Follow the user's current scope. Communicate in Ukrainian; use English for code, UI copy and submission documents.
- Read `.local/task/current.md` for the current checkpoint. For implementation, read only the relevant rows of `.local/task/01-requirements.md` and the matching original section in `00-original-spec.md`.
- The original spec defines requirements; local architecture notes are proposals. User clarifications take precedence. Keep the original unchanged.
- Build the user-requested list of three mock conversations, their shared chat screen and a simulated subscription paywall. Use `.local/design/README.md` for visual scope; search/filter/sort, media/gift/PPV and other adjacent features are excluded.
- Keep `.local/` out of commits, pushes and submission archives. If local references are absent, use available user context and report the missing source before making requirement-dependent assumptions.
- Keep README short: setup/run/check commands and the explanations/results requested by the assignment. Store setup history and detailed internal diagnostics in `.local/`; add submission results as they become available.

## Expo and code

- Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code. Read relevant API pages for SDK 57 when selecting or using native dependencies; do not assume older Expo APIs apply.
- Preserve Yarn Classic and `yarn.lock`. Run `yarn validate` for typecheck, lint, formatting and behavioral tests; `yarn lint:fix` / `yarn format` apply fixes. `yarn test` runs focused tests against real file-backed SQLite. Check `package.json` for other commands.
- Read `src/AGENTS.md` before source changes. Choose the smallest coherent implementation that satisfies the relevant requirement and can be explained in the walkthrough.

## Load skills only for the current work

Paths are relative to the repository root. Read the applicable `SKILL.md` when doing the corresponding work; the same files can be read by agents without native skill discovery.

| Work | Skill |
| --- | --- |
| Outbox, retry, mock acceptance, restart, ordering or sync | `.agents/skills/fans-chat-recovery/SKILL.md` |
| Purchase, restoration, backend confirmation or access policy | `.agents/skills/fans-paid-access/SKILL.md` |
| Chat/paywall layout, interaction, pagination or profiling | `.agents/skills/fans-chat-ui/SKILL.md` |
| Acceptance review, demo recordings, measurements or submission | `.agents/skills/fans-verification/SKILL.md` |

## Working loop

- Select the requirement IDs and smallest useful slice. Resolve routine implementation choices directly; ask only about material missing product decisions, continuing independent work meanwhile.
- Keep business state changes explicit. Test durable recovery and payment boundaries where correctness depends on them; a styling edit needs a relevant visual check, not ceremonial tests.
- Report what changed, the relevant check and its result, and any real limitation. Never equate code written with a scenario demonstrated or performance measured.
- After a meaningful completed slice, update `.local/task/current.md` with paths, evidence and next step. Update affected requirement status only when supported; preserve actual time and useful AI corrections for submission.
- Use existing permissions. This setup adds no automatic commits, uploads, emails, command allowlists, hooks or agent delegation.
