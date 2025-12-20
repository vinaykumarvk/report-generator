# Report Generator

Bootstrap Next.js application with TypeScript, Prisma, linting/formatting, Jest-based testing, and local infrastructure via Docker Compose (Postgres with pgvector, Redis, and MinIO for S3-compatible storage).

## Prerequisites
- Node.js 18+
- npm or pnpm
- Docker + Docker Compose

## Getting Started
1. Copy `.env.example` to `.env` and update secrets/connection strings as needed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start infrastructure:
   ```bash
   docker compose up -d db redis storage storage-init
   ```
4. Generate the Prisma client and run migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```
5. Seed baseline data:
   ```bash
   npm run prisma:seed
   ```
6. Run the Next.js dev server:
   ```bash
   npm run dev
   ```

## Scripts
- `npm run dev` – Start Next.js in development mode.
- `npm run build` / `npm run start` – Build and serve the production bundle.
- `npm run lint` – Run ESLint (Next.js rules + Prettier).
- `npm run format` / `npm run format:check` – Format or verify formatting with Prettier.
- `npm run typecheck` – TypeScript compilation without emit.
- `npm run test` – Jest test suite configured with `next/jest` and Testing Library.
- `npm run prisma:generate` – Generate Prisma Client.
- `npm run prisma:migrate` – Create and apply a new migration.
- `npm run prisma:deploy` – Apply migrations in production environments.
- `npm run prisma:seed` – Seed baseline workspace/user data.

## Docker Services
- **db**: Postgres with pgvector enabled via `ops/db/init.sql`.
- **redis**: Redis 7 with persistence enabled.
- **storage**: MinIO for S3-compatible storage (with `storage-init` creating the default bucket).

## Shared Libraries
- `src/lib/config.ts` – Typed configuration loader using Zod for validation.
- `src/lib/logger.ts` – Structured logging with Pino and environment-aware transport.
- `src/lib/errors.ts` – AppError helper and assertion utilities.
- `src/lib/features.ts` – Feature flag accessors backed by environment config.
- `src/lib/result.ts` – Typed result helpers for functional-style flows.

## Prisma Schema
The initial models include `Workspace`, `User`, and `WorkspaceMember` with role enum support and pgvector extension enabled for future embedding use cases. Seed data provisions a demo workspace owner.

## Testing
Jest is wired through `next/jest` with jsdom environment and Testing Library utilities. Add tests under `tests/` or alongside source files.
# Report Generator Evidence Scoring

This repository provides utilities to score **coverage**, **diversity**, **recency**, and **redundancy** for evidence bundles, persist section-level results, and render an aggregated report dashboard.

## Usage

1. Install dependencies (standard library only) and ensure `python3.10+` is available.
2. Prepare a report payload similar to `sample_report.json`.
3. Run the CLI (set `PYTHONPATH=src` or install in editable mode first):

```bash
PYTHONPATH=src python -m report_generator.cli --input sample_report.json --output output
```

Outputs include:

* Section-level JSON score files in `output/sections/`
* A report-level JSON dashboard in `output/reports/`
* Markdown/HTML/JSON dashboard exports in `output/`

## Development

Run tests with:

```bash
pytest
```
