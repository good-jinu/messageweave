import type {
	ChatCoreSchemaDialect,
	ChatCoreSchemaFormat,
	ChatCoreSchemaIdStrategy,
	ChatCoreSchemaProvider,
	GenerateChatCoreSchemaOptions,
} from "./generate";

export type CliCommand =
	| { type: "help" }
	| { type: "schema-generate"; options: SchemaGenerateCommandOptions }
	| { type: "version" };

export type SchemaGenerateCommandOptions = GenerateChatCoreSchemaOptions & {
	out?: string;
};

export type ParseCliArgsResult =
	| { ok: true; command: CliCommand }
	| { ok: false; message: string };

const FORMATS = ["drizzle", "prisma", "sql"] as const;
const DIALECTS = ["mysql", "postgres", "sqlite"] as const;
const PRISMA_PROVIDERS = [
	"cockroachdb",
	"mongodb",
	"mysql",
	"postgres",
	"postgresql",
	"sqlite",
	"sqlserver",
] as const;
const ID_STRATEGIES = ["number", "serial", "string", "uuid"] as const;

export function parseCliArgs(argv: string[]): ParseCliArgsResult {
	if (argv.length === 0 || hasHelpFlag(argv)) {
		return { ok: true, command: { type: "help" } };
	}

	const first = argv[0];
	if (first === "--version" || first === "-v") {
		return { ok: true, command: { type: "version" } };
	}

	if (first !== "schema" || argv[1] !== "generate") {
		return {
			ok: false,
			message: `Unknown command: ${argv.join(" ")}`,
		};
	}

	return parseSchemaGenerateOptions(argv.slice(2));
}

function parseSchemaGenerateOptions(args: string[]): ParseCliArgsResult {
	let format: ChatCoreSchemaFormat = "sql";
	let dialect: string | undefined;
	let provider: ChatCoreSchemaProvider | undefined;
	let includeDatasource: boolean | undefined;
	let idStrategy: ChatCoreSchemaIdStrategy | undefined;
	let out: string | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const token = args[index];
		if (token === undefined) continue;

		if (token === "--include-datasource") {
			includeDatasource = true;
			continue;
		}

		const option = parseOptionToken(token, args[index + 1]);
		if (!option.ok) return option;

		if (option.consumedNext) index += 1;

		if (option.name === "--format") {
			if (!isFormat(option.value)) {
				return {
					ok: false,
					message: `Invalid --format value: ${option.value}. Expected: sql, drizzle, prisma`,
				};
			}
			format = option.value;
			continue;
		}

		if (option.name === "--dialect") {
			dialect = option.value;
			continue;
		}

		if (option.name === "--provider") {
			if (!isPrismaProvider(option.value)) {
				return {
					ok: false,
					message: `Invalid --provider value: ${option.value}`,
				};
			}
			provider = option.value;
			continue;
		}

		if (option.name === "--include-datasource") {
			includeDatasource = option.value === "true";
			continue;
		}

		if (option.name === "--id-strategy") {
			if (!isIdStrategy(option.value)) {
				return {
					ok: false,
					message: `Invalid --id-strategy value: ${option.value}`,
				};
			}
			idStrategy = option.value;
			continue;
		}

		if (option.name === "--out") {
			out = option.value;
			continue;
		}

		return { ok: false, message: `Unknown option: ${option.name}` };
	}

	if (format === "sql" || format === "drizzle") {
		if (dialect === undefined) {
			return {
				ok: false,
				message: "Missing required option: --dialect <mysql|postgres|sqlite>",
			};
		}
		if (!isDialect(dialect)) {
			return {
				ok: false,
				message: `Invalid --dialect value: ${dialect}`,
			};
		}

		return {
			ok: true,
			command: {
				type: "schema-generate",
				options:
					format === "drizzle"
						? { format: "drizzle", dialect, idStrategy, out }
						: { format: "sql", dialect, idStrategy, out },
			},
		};
	}

	if (format === "prisma") {
		const targetProvider =
			provider ??
			(dialect && isPrismaProvider(dialect) ? dialect : undefined) ??
			"postgresql";

		if (
			dialect !== undefined &&
			provider === undefined &&
			!isPrismaProvider(dialect)
		) {
			return {
				ok: false,
				message: `Invalid --dialect value for Prisma provider: ${dialect}`,
			};
		}

		return {
			ok: true,
			command: {
				type: "schema-generate",
				options: {
					format: "prisma",
					provider: targetProvider,
					includeDatasource,
					idStrategy,
					out,
				},
			},
		};
	}

	return {
		ok: false,
		message: `Unsupported format: ${format}`,
	};
}

function hasHelpFlag(argv: string[]): boolean {
	return argv.some((arg) => arg === "--help" || arg === "-h");
}

function parseOptionToken(
	token: string,
	nextToken: string | undefined,
):
	| { ok: true; consumedNext: boolean; name: string; value: string }
	| { ok: false; message: string } {
	const equalsIndex = token.indexOf("=");
	if (equalsIndex !== -1) {
		const name = token.slice(0, equalsIndex);
		const value = token.slice(equalsIndex + 1);
		if (value.length === 0) {
			return { ok: false, message: `Missing value for option: ${name}` };
		}
		return { ok: true, consumedNext: false, name, value };
	}

	if (!token.startsWith("--")) {
		return { ok: false, message: `Unexpected argument: ${token}` };
	}

	if (nextToken === undefined || nextToken.startsWith("--")) {
		return { ok: false, message: `Missing value for option: ${token}` };
	}

	return { ok: true, consumedNext: true, name: token, value: nextToken };
}

function isFormat(value: string): value is ChatCoreSchemaFormat {
	return FORMATS.some((format) => format === value);
}

function isDialect(value: string): value is ChatCoreSchemaDialect {
	return DIALECTS.some((dialect) => dialect === value);
}

function isPrismaProvider(value: string): value is ChatCoreSchemaProvider {
	return PRISMA_PROVIDERS.some((p) => p === value);
}

function isIdStrategy(value: string): value is ChatCoreSchemaIdStrategy {
	return ID_STRATEGIES.some((strategy) => strategy === value);
}
