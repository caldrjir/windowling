## What & why

<!-- One or two sentences. Link the issue: Closes #123 -->

## How it was verified

- [ ] `pnpm check` (lint, format, typecheck, tests, build)
- [ ] `pnpm test:e2e` (if UI, auth or server behaviour changed)
- [ ] Tested on a phone-sized viewport (if UI changed)

## Checklist

- [ ] Respects package boundaries (see `docs/architecture.md`)
- [ ] Schema change comes with a migration (`pnpm db:generate`)
- [ ] Docs updated for architectural or workflow changes
- [ ] No secrets, tokens or personal data committed
- [ ] Games keep their logic, balance and save format; secrets stay server-side
