import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = resolve(websiteDirectory, "../packages/messageweave");
const packageJson = JSON.parse(
	readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
);

const entryPoints = Object.values(packageJson.exports)
	.map((conditions) => conditions["dev-source"])
	.filter((source) => typeof source === "string")
	.map((source) => resolve(packageDirectory, source));

if (entryPoints.length === 0) {
	throw new Error(
		"No MessageWeave public entry points were found in package.json",
	);
}

const pnpmPath = process.env.npm_execpath;
if (!pnpmPath) {
	throw new Error("Run API generation through pnpm so TypeDoc can be resolved");
}

const result = spawnSync(
	pnpmPath,
	[
		"exec",
		"typedoc",
		"--options",
		resolve(websiteDirectory, "typedoc.json"),
		...entryPoints,
	],
	{
		cwd: websiteDirectory,
		shell: process.platform === "win32",
		stdio: "inherit",
	},
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
