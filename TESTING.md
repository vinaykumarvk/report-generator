# Testing

## JavaScript/TypeScript (Jest)

```bash
npm test
```

## Type Checking

```bash
npm run typecheck
```

## Python (Pytest)

```bash
./scripts/pytest.sh
```

The script creates a local `.venv` (if missing), installs `requirements.txt`, and then runs pytest.

## UI/UX Gate (Mobile-first)

```bash
node scripts/ui-ux-gate.js
```

Defaults to `http://localhost:3000` and checks `/`, `/runs`, `/template-studio`.
Override with:

```bash
UI_UX_BASE_URL="http://localhost:3000" UI_UX_PATHS="/,/runs" node scripts/ui-ux-gate.js
```

## Notes
- JS tests use `next/jest` with jsdom by default; node-specific tests use `@jest-environment node`.
- Some integration tests mock external services (Supabase, network) for determinism.
- Python tests run in a virtualenv with Python 3.10+.
