#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseCliArgs } from "./args";
import { generateMessageWeaveSchema } from "./generate";
import { VERSION } from "./version";

const USAGE = `Usage:
  messageweave schema generate [--format <sql|drizzle|prisma>] [options]

Options:
  --format              Format to generate: sql, drizzle, or prisma (default: sql).
  --dialect             Database dialect (required for sql/drizzle): sqlite, postgres, or mysql.
  --provider            Database provider for Prisma (default: postgresql): postgresql, mysql, sqlite, etc.
  --include-datasource  Include datasource and generator client blocks in Prisma schema.
  --id-strategy         id column strategy: string, uuid, serial, or number.
  --out                 Write generated schema to a file instead of stdout.
  -h, --help            Show this help message.
  -v, --version         Show the CLI version.
`;

async function main(argv: string[]): Promise<void> {
	const parsed = parseCliArgs(argv);
	if (!parsed.ok) {
		process.stderr.write(`${parsed.message}\n\n${USAGE}`);
		process.exitCode = 1;
		return;
	}

	if (parsed.command.type === "help") {
		process.stdout.write(USAGE);
		return;
	}

	if (parsed.command.type === "version") {
		process.stdout.write(`${VERSION}\n`);
		return;
	}

	const schema = await generateMessageWeaveSchema(parsed.command.options);
	if (parsed.command.options.out === undefined) {
		process.stdout.write(ensureTrailingNewline(schema));
		return;
	}

	const outPath = resolve(parsed.command.options.out);
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, ensureTrailingNewline(schema), "utf8");
	process.stdout.write(`Generated MessageWeave schema: ${outPath}\n`);
}

function ensureTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}

main(process.argv.slice(2)).catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
