# @messageweave/cli

Command-line tools for MessageWeave.

The CLI is shipped separately from the runtime `messageweave` package so application
code does not install CLI-only dependencies. Internally, this package uses
`unadapter` to generate database schema SQL from MessageWeave's canonical storage
schema.

## Usage

Generate starter SQL for MessageWeave's storage tables:

```bash
pnpm dlx @messageweave/cli schema generate --dialect sqlite --out migrations/001_messageweave.sql
```

Print SQL to stdout:

```bash
pnpm dlx @messageweave/cli schema generate --dialect postgres
```

## Commands

### `schema generate`

```bash
messageweave schema generate --dialect <sqlite|postgres|mysql> [--out <file>]
```

Options:

| Option | Description |
| --- | --- |
| `--dialect` | Required. SQL dialect to generate: `sqlite`, `postgres`, or `mysql`. |
| `--out` | Optional. Write SQL to a file instead of stdout. Parent directories are created automatically. |
| `--id-strategy` | Optional. Primary-key strategy: `string`, `uuid`, `serial`, or `number`. Defaults to `string`. |

## Examples

SQLite:

```bash
pnpm dlx @messageweave/cli schema generate --dialect sqlite --out migrations/001_messageweave.sql
```

Postgres with database-generated UUID ids:

```bash
pnpm dlx @messageweave/cli schema generate --dialect postgres --id-strategy uuid
```

MySQL:

```bash
pnpm dlx @messageweave/cli schema generate --dialect mysql
```

## Scope

The generated SQL creates MessageWeave's five storage tables:

- `room`
- `event`
- `eventEdge`
- `roomState`
- `sequence`

This CLI only generates schema DDL. Your application still owns the
`MessageWeaveStorage` implementation, including JSON serialization, row decoding,
query translation, and any database-specific atomicity requirements.

