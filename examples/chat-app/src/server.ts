import { mkdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { FlowEvent, JsonObject, Room } from "messageweave";
import { createMessageWeave } from "messageweave";
import { drizzleAdapter } from "messageweave/drizzle";
import * as schema from "./db/schema/index.js";
import { ensureMessageWeaveSchema } from "./schema.js";

type JsonRecord = Record<string, unknown>;

interface SerializedRoom {
	id: string;
	creatorId: string;
	createdAt: number;
	name: string;
	topic: string;
}

interface SerializedEvent {
	id: string;
	roomId: string;
	senderId: string;
	displayName: string;
	type: string;
	body: string;
	content: JsonObject;
	timestamp: number;
	sequenceId: number;
}

interface Member {
	userId: string;
	displayName: string;
}

interface SseClient {
	response: ServerResponse;
}

type SsePayload =
	| { type: "event"; event: SerializedEvent }
	| { type: "room.created"; room: SerializedRoom }
	| { type: "sync"; events: SerializedEvent[]; nextToken: number };

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "5173", 10);
const projectDir = fileURLToPath(new URL("../", import.meta.url));
const publicDir = join(projectDir, "public");
const migrationsFolder = join(projectDir, "drizzle");
const dataDir = join(projectDir, "data");
const databasePath =
	process.env.DATABASE_URL ?? join(dataDir, "messageweave.sqlite");
const clientScriptPath = join(projectDir, "dist", "client.js");
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

await mkdir(dataDir, { recursive: true });
const sqlite = new Database(databasePath);
const database = drizzle(sqlite, { schema });
ensureMessageWeaveSchema({ db: database, sqlite, migrationsFolder });

const flow = createMessageWeave({
	storage: drizzleAdapter(database, { provider: "sqlite", schema }),
	defaultLimit: 100,
	hooks: {
		onPublish: (event) => {
			broadcast({ type: "event", event: serializeEvent(event) });
		},
		onRoomCreated: (room) => {
			broadcast({ type: "room.created", room: serializeRoom(room) });
		},
	},
});
const rooms = new Map<string, Room>();
const clients = new Set<SseClient>();

await seedUsers();
await loadRooms();
if (rooms.size === 0) {
	const general = await createRoom({
		creatorId: "u_system",
		name: "General",
		topic: "A shared room backed by MessageWeave events in SQLite.",
	});
	await publishSystemMessage(
		general.id,
		"Welcome. This room is persisted in examples/chat-app/data/messageweave.sqlite.",
	);
}

async function seedUsers(): Promise<void> {
	const existing = await database.select().from(schema.user).all();
	if (existing.length === 0) {
		const now = Date.now();
		await database.insert(schema.user).values([
			{
				id: "u_alice",
				username: "alice",
				displayName: "Alice",
				createdAt: now,
			},
			{
				id: "u_bob",
				username: "bob",
				displayName: "Bob",
				createdAt: now,
			},
			{
				id: "u_charlie",
				username: "charlie",
				displayName: "Charlie",
				createdAt: now,
			},
		]);
	}
}

function jsonResponse(
	response: ServerResponse,
	status: number,
	payload: unknown,
): void {
	const body = JSON.stringify(payload);
	response.writeHead(status, {
		"content-length": String(textEncoder.encode(body).byteLength),
		"content-type": "application/json; charset=utf-8",
	});
	response.end(body);
}

function textResponse(
	response: ServerResponse,
	status: number,
	body: string,
): void {
	response.writeHead(status, {
		"content-length": String(textEncoder.encode(body).byteLength),
		"content-type": "text/plain; charset=utf-8",
	});
	response.end(body);
}

async function readJson(request: IncomingMessage): Promise<JsonRecord> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of request) {
		chunks.push(
			typeof chunk === "string"
				? textEncoder.encode(chunk)
				: new Uint8Array(chunk),
		);
	}
	if (chunks.length === 0) return {};

	const byteLength = chunks.reduce(
		(total, chunk) => total + chunk.byteLength,
		0,
	);
	const body = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	const parsed: unknown = JSON.parse(textDecoder.decode(body));
	return asObject(parsed);
}

function asObject(value: unknown): JsonRecord {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: {};
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value.trim() : fallback;
}

function eventBody(event: FlowEvent): string {
	return typeof event.content.body === "string" ? event.content.body : "";
}

function eventDisplayName(event: FlowEvent): string {
	return typeof event.content.displayName === "string"
		? event.content.displayName
		: event.senderId;
}

function serializeEvent(event: FlowEvent): SerializedEvent {
	return {
		id: event.id,
		roomId: event.roomId,
		senderId: event.senderId,
		displayName: eventDisplayName(event),
		type: event.type,
		body: eventBody(event),
		content: event.content,
		timestamp: event.timestamp,
		sequenceId: event.sequenceId,
	};
}

function serializeRoom(room: Room): SerializedRoom {
	return {
		id: room.id,
		creatorId: room.creatorId,
		createdAt: room.createdAt,
		name:
			typeof room.metadata.name === "string"
				? room.metadata.name
				: "Untitled room",
		topic: typeof room.metadata.topic === "string" ? room.metadata.topic : "",
	};
}

function sendSse(client: SseClient, payload: SsePayload): void {
	client.response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(payload: SsePayload): void {
	for (const client of clients) {
		sendSse(client, payload);
	}
}

async function createRoom(input: {
	creatorId: string;
	name: string;
	topic?: string;
}): Promise<Room> {
	const room = await flow.createRoom({
		creatorId: input.creatorId,
		metadata: { name: input.name, topic: input.topic ?? "" },
	});
	rooms.set(room.id, room);
	return room;
}

async function loadRooms(): Promise<void> {
	for (const room of await flow.listRooms({ limit: 500, order: "asc" })) {
		rooms.set(room.id, room);
	}
}

async function publishSystemMessage(
	roomId: string,
	body: string,
): Promise<FlowEvent> {
	const result = await flow.publishEvent({
		roomId,
		senderId: "system",
		type: "message.text",
		content: { body, displayName: "System" },
	});
	return result.event;
}

async function publishMemberState(
	roomId: string,
	userId: string,
	displayName: string,
) {
	return flow.publishEvent({
		roomId,
		senderId: userId,
		type: "room.member",
		stateKey: userId,
		content: { membership: "join", displayName },
	});
}

async function listMembers(roomId: string): Promise<Member[]> {
	const state = await flow.getRoomState(roomId);
	return state
		.filter((event) => event.type === "room.member")
		.map((event) => ({
			userId: event.stateKey ?? event.senderId,
			displayName: eventDisplayName(event),
		}))
		.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function handleApi(
	request: IncomingMessage,
	response: ServerResponse,
	url: URL,
): Promise<void> {
	if (request.method === "GET" && url.pathname === "/api/bootstrap") {
		const users = await database.select().from(schema.user).all();
		jsonResponse(response, 200, {
			rooms: Array.from(rooms.values()).map(serializeRoom),
			users,
		});
		return;
	}

	if (request.method === "GET" && url.pathname === "/api/users") {
		const users = await database.select().from(schema.user).all();
		jsonResponse(response, 200, { users });
		return;
	}

	if (request.method === "POST" && url.pathname === "/api/users") {
		const input = await readJson(request);
		const username = asString(input.username)
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "");
		const displayName = asString(input.displayName, username);
		if (username.length === 0) {
			jsonResponse(response, 400, { error: "Username is required" });
			return;
		}
		const existing = await database
			.select()
			.from(schema.user)
			.where(eq(schema.user.username, username))
			.get();
		if (existing) {
			jsonResponse(response, 200, { user: existing });
			return;
		}
		const newUser = {
			id: `u_${username}`,
			username,
			displayName,
			createdAt: Date.now(),
		};
		await database.insert(schema.user).values(newUser);
		jsonResponse(response, 201, { user: newUser });
		return;
	}

	if (request.method === "POST" && url.pathname === "/api/rooms") {
		const input = await readJson(request);
		const name = asString(input.name, "New room");
		const creatorId = asString(input.creatorId, "guest");
		const topic = asString(input.topic);
		const room = await createRoom({ creatorId, name, topic });
		const serialized = serializeRoom(room);
		jsonResponse(response, 201, { room: serialized });
		return;
	}

	const timelineMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/timeline$/);
	if (request.method === "GET" && timelineMatch?.[1] !== undefined) {
		const roomId = decodeURIComponent(timelineMatch[1]);
		if (!rooms.has(roomId)) {
			jsonResponse(response, 404, { error: "Room not found" });
			return;
		}
		const events = await flow.getRoomTimeline(roomId, { limit: 100 });
		jsonResponse(response, 200, {
			events: events.slice().reverse().map(serializeEvent),
			members: await listMembers(roomId),
		});
		return;
	}

	const joinMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
	if (request.method === "POST" && joinMatch?.[1] !== undefined) {
		const roomId = decodeURIComponent(joinMatch[1]);
		if (!rooms.has(roomId)) {
			jsonResponse(response, 404, { error: "Room not found" });
			return;
		}
		const input = await readJson(request);
		const userId = asString(input.userId, "guest");
		const displayName = asString(input.displayName, userId);
		const { event } = await publishMemberState(roomId, userId, displayName);
		jsonResponse(response, 200, {
			event: serializeEvent(event),
			members: await listMembers(roomId),
		});
		return;
	}

	const messageMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
	if (request.method === "POST" && messageMatch?.[1] !== undefined) {
		const roomId = decodeURIComponent(messageMatch[1]);
		if (!rooms.has(roomId)) {
			jsonResponse(response, 404, { error: "Room not found" });
			return;
		}
		const input = await readJson(request);
		const body = asString(input.body);
		if (body.length === 0) {
			jsonResponse(response, 400, { error: "Message body is required" });
			return;
		}
		const senderId = asString(input.senderId, "guest");
		const displayName = asString(input.displayName, senderId);
		const { event } = await flow.publishEvent({
			roomId,
			senderId,
			type: "message.text",
			content: { body, displayName },
		});
		jsonResponse(response, 201, { event: serializeEvent(event) });
		return;
	}

	const singleMessageMatch = url.pathname.match(
		/^\/api\/rooms\/([^/]+)\/messages\/([^/]+)$/,
	);
	if (
		request.method === "PATCH" &&
		singleMessageMatch?.[1] !== undefined &&
		singleMessageMatch?.[2] !== undefined
	) {
		const roomId = decodeURIComponent(singleMessageMatch[1]);
		const messageId = decodeURIComponent(singleMessageMatch[2]);
		if (!rooms.has(roomId)) {
			jsonResponse(response, 404, { error: "Room not found" });
			return;
		}
		const input = await readJson(request);
		const body = asString(input.body);
		if (body.length === 0) {
			jsonResponse(response, 400, { error: "Message body is required" });
			return;
		}
		const senderId = asString(input.senderId, "guest");
		const displayName = asString(input.displayName, senderId);
		const { event } = await flow.editMessage({
			roomId,
			senderId,
			messageId,
			body,
			content: { displayName },
		});
		jsonResponse(response, 200, { event: serializeEvent(event) });
		return;
	}

	if (
		request.method === "DELETE" &&
		singleMessageMatch?.[1] !== undefined &&
		singleMessageMatch?.[2] !== undefined
	) {
		const roomId = decodeURIComponent(singleMessageMatch[1]);
		const messageId = decodeURIComponent(singleMessageMatch[2]);
		if (!rooms.has(roomId)) {
			jsonResponse(response, 404, { error: "Room not found" });
			return;
		}
		const input = await readJson(request);
		const senderId = asString(input.senderId, "guest");
		const reason = asString(input.reason, "Deleted by user");
		const { event } = await flow.deleteMessage({
			roomId,
			senderId,
			messageId,
			reason,
		});
		jsonResponse(response, 200, { event: serializeEvent(event) });
		return;
	}

	if (request.method === "GET" && url.pathname === "/api/events") {
		response.writeHead(200, {
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
			"content-type": "text/event-stream; charset=utf-8",
		});
		response.write("\n");

		const client = { response };
		clients.add(client);

		const since = Number.parseInt(url.searchParams.get("since") ?? "0", 10);
		const sync = await flow.getSyncStream({
			sinceSequenceId: Number.isFinite(since) ? since : 0,
		});
		sendSse(client, {
			type: "sync",
			events: sync.events.map(serializeEvent),
			nextToken: sync.nextToken,
		});

		request.on("close", () => {
			clients.delete(client);
		});
		return;
	}

	jsonResponse(response, 404, { error: "Not found" });
}

async function serveStatic(
	response: ServerResponse,
	pathname: string,
): Promise<void> {
	const requested = pathname === "/" ? "/index.html" : pathname;
	const normalized = normalize(decodeURIComponent(requested)).replace(
		/^(\.\.[/\\])+/,
		"",
	);
	const filePath =
		normalized === "/app.js" ? clientScriptPath : join(publicDir, normalized);
	if (filePath !== clientScriptPath && !filePath.startsWith(publicDir)) {
		textResponse(response, 403, "Forbidden");
		return;
	}

	const contentTypes: Record<string, string> = {
		".css": "text/css; charset=utf-8",
		".html": "text/html; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
	};

	try {
		const body = await readFile(filePath);
		response.writeHead(200, {
			"content-length": String(body.byteLength),
			"content-type":
				contentTypes[extname(filePath)] ?? "application/octet-stream",
		});
		response.end(body);
	} catch {
		textResponse(response, 404, "Not found");
	}
}

const server = createServer((request, response) => {
	const url = new URL(
		request.url ?? "/",
		`http://${request.headers.host ?? "localhost"}`,
	);
	const task = url.pathname.startsWith("/api/")
		? handleApi(request, response, url)
		: serveStatic(response, url.pathname);

	task.catch((error: unknown) => {
		console.error(error);
		if (!response.headersSent) {
			jsonResponse(response, 500, { error: "Internal server error" });
			return;
		}
		response.end();
	});
});

server.listen(port, host, () => {
	console.log(`MessageWeave example listening on http://${host}:${port}`);
});
