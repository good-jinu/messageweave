# ChatCore Development Guide

This is the ChatCore repository — an in-process, database-agnostic,
event-sourced messaging engine for TypeScript. It provides the core logical
engine for chat applications, leaving the transport layer (HTTP, WebSockets,
gRPC) and the storage engine to the integrating developer.

## Project Structure

- `packages/messageweave` — the SDK (`messageweave`)
  - `src/types` — domain types (`FlowEvent`, `Room`, `EventEdge`, sync types)
  - `src/db` — storage adapter wrapper and monotonic sequence assignment
  - `src/adapters` — built-in database entry points backed internally by
    `unadapter`
  - `src/schema.ts` — framework-neutral canonical storage schema
  - `src/engine` — pipelines: `rooms`, `publish`, `state`, `timeline`, `sync`
  - `src/test-utils` — `getTestInstance()` + a corrected in-memory adapter

## Database layer

- The engine depends only on the public `ChatCoreStorage` contract. Applications
  may provide a custom implementation or use the `messageweave/drizzle`,
  `messageweave/prisma`, `messageweave/kysely`, `messageweave/knex`,
  `messageweave/mongodb`, and `messageweave/sumak` entry points.
- Built-in database entry points use
  [`unadapter`](https://www.npmjs.com/package/unadapter) internally. Do not expose
  Unadapter configuration or require application code to import it.
- `ChatCoreStorage` exposes no transaction primitive, so `publishEvent` is
  serialized in-process to keep `sequenceId` strictly increasing (see
  `src/db/sequence.ts`).

## Commands

- ALWAYS use `pnpm` (never npm, yarn, or bun)
- Run a single test: `vitest path/to/test -t <pattern>` (from the package dir)
- Type check: `pnpm typecheck`
- Formatting/linting runs automatically on commit via the `mise` pre-commit task.

## Writing Code

- Must work across Node.js, Bun, Deno, and Cloudflare Workers. Avoid runtime-specific APIs.
- Biome (tabs for code, 2 spaces for JSON)
- NEVER use `any`. NEVER use classes.
- Use `Uint8Array` instead of `Buffer` (except in tests)
- Import zod as `import * as z from "zod"`
- Use `import type` for type-only imports
- Use `node:` protocol for Node.js built-ins (e.g. `node:crypto`)
- JSDoc comments for public APIs

## Testing

- Tests use Vitest. Use `getTestInstance()` from `chatcore/test`; it
  returns `{ flow, db }` backed by the in-memory adapter.
- Regression tests: add `@see` comment with the issue URL above `it()`/`describe()`.

## Documentation

- Public exports and their top-level types must have TSDoc comments. TypeDoc
  treats missing documentation, broken links, and unresolved exports as errors.
- Do not hand-copy API signatures or option tables into Markdown. The website
  discovers public entry points from `packages/messageweave/package.json` and
  generates the API reference before every start and build.
- Keep handwritten docs focused on workflows, concepts, and operational
  guidance that cannot be derived from source types.
- Run `pnpm docs:check` to typecheck the website, regenerate the API reference,
  and build Docusaurus exactly as CI does.

## Important Development Notes

- Bug fixes and new features MUST include tests
- For bug fixes: if the issue is reproducible in a test, write a failing test first, then implement the fix
- Ensure `pnpm typecheck` passes before finishing
- DO NOT COMMIT unless the user explicitly asks
- Conventional Commits: `feat(scope):`, `fix(scope):`, `docs:`, `chore:`. Use `!` for breaking changes
- PRs target `main`
