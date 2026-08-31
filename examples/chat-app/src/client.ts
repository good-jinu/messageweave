interface SerializedRoom {
	id: string;
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
	content: Record<string, unknown>;
	timestamp: number;
	sequenceId: number;
}

interface Member {
	userId: string;
	displayName: string;
}

interface BootstrapResponse {
	rooms: SerializedRoom[];
}

interface TimelineResponse {
	events: SerializedEvent[];
	members: Member[];
}

interface RoomResponse {
	room: SerializedRoom;
}

interface JoinResponse {
	event: SerializedEvent;
	members: Member[];
}

type ApiResponseMap = {
	"/api/bootstrap": BootstrapResponse;
};

type SsePayload =
	| { type: "event"; event: SerializedEvent }
	| { type: "room.created"; room: SerializedRoom }
	| { type: "sync"; events: SerializedEvent[]; nextToken: number };

interface ProjectedClientMessage {
	id: string;
	roomId: string;
	senderId: string;
	displayName: string;
	body: string;
	timestamp: number;
	sequenceId: number;
	isEdited: boolean;
	editedAt: number | null;
	isDeleted: boolean;
}

const state = {
	rooms: [] as SerializedRoom[],
	activeRoomId: "",
	eventsByRoom: new Map<string, SerializedEvent[]>(),
	membersByRoom: new Map<string, Member[]>(),
	seenEventIds: new Set<string>(),
	userId: localStorage.getItem("messageweave:userId") ?? crypto.randomUUID(),
	displayName: localStorage.getItem("messageweave:displayName") ?? "",
	editingMessageId: null as string | null,
};

localStorage.setItem("messageweave:userId", state.userId);

function requireElement<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (element === null) {
		throw new Error(`Missing element: ${selector}`);
	}
	return element;
}

const elements = {
	connectionStatus: requireElement<HTMLSpanElement>("#connectionStatus"),
	displayName: requireElement<HTMLInputElement>("#displayName"),
	joinButton: requireElement<HTMLButtonElement>("#joinButton"),
	memberList: requireElement<HTMLDivElement>("#memberList"),
	messageBody: requireElement<HTMLInputElement>("#messageBody"),
	messageForm: requireElement<HTMLFormElement>("#messageForm"),
	messages: requireElement<HTMLDivElement>("#messages"),
	roomForm: requireElement<HTMLFormElement>("#roomForm"),
	roomList: requireElement<HTMLElement>("#roomList"),
	roomName: requireElement<HTMLInputElement>("#roomName"),
	roomTitle: requireElement<HTMLHeadingElement>("#roomTitle"),
	roomTopic: requireElement<HTMLParagraphElement>("#roomTopic"),
};

elements.displayName.value = state.displayName;

function setStatus(label: string): void {
	elements.connectionStatus.textContent = label;
	elements.connectionStatus.dataset.state = label.toLowerCase();
}

function currentDisplayName(): string {
	const value = elements.displayName.value.trim();
	return value.length > 0 ? value : `Guest ${state.userId.slice(0, 4)}`;
}

function rememberDisplayName(): void {
	state.displayName = currentDisplayName();
	localStorage.setItem("messageweave:displayName", state.displayName);
}

async function api<K extends keyof ApiResponseMap>(
	path: K,
	options?: RequestInit,
): Promise<ApiResponseMap[K]>;
async function api<T>(path: string, options?: RequestInit): Promise<T>;
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		headers: { "content-type": "application/json" },
		...options,
	});
	if (!response.ok) {
		const payload = (await response
			.json()
			.catch(() => ({ error: response.statusText }))) as { error?: string };
		throw new Error(payload.error ?? "Request failed");
	}
	return (await response.json()) as T;
}

function activeRoom(): SerializedRoom | null {
	return state.rooms.find((room) => room.id === state.activeRoomId) ?? null;
}

function formatTime(timestamp: number): string {
	const instant = Temporal.Instant.fromEpochMilliseconds(timestamp);
	const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
	return zonedDateTime.toLocaleString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

function renderRooms(): void {
	elements.roomList.replaceChildren(
		...state.rooms.map((room) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "room-button";
			button.dataset.active = String(room.id === state.activeRoomId);
			button.textContent = room.name;
			button.addEventListener("click", () => {
				void selectRoom(room.id);
			});
			return button;
		}),
	);
}

function mergeRoom(room: SerializedRoom): void {
	state.rooms = state.rooms.filter((item) => item.id !== room.id);
	state.rooms.push(room);
	state.rooms.sort((a, b) => a.name.localeCompare(b.name));
}

function renderMembers(): void {
	const members = state.membersByRoom.get(state.activeRoomId) ?? [];
	if (members.length === 0) {
		elements.memberList.textContent = "No joined members yet";
		return;
	}
	elements.memberList.replaceChildren(
		...members.map((member) => {
			const item = document.createElement("span");
			item.textContent = member.displayName;
			return item;
		}),
	);
}

function projectRoomMessages(
	events: SerializedEvent[],
): ProjectedClientMessage[] {
	const chronological = [...events].sort((a, b) => a.sequenceId - b.sequenceId);
	const messageMap = new Map<string, ProjectedClientMessage>();
	const orderedIds: string[] = [];

	for (const event of chronological) {
		if (event.type === "message.edit") {
			const targetId =
				typeof event.content?.targetMessageId === "string"
					? event.content.targetMessageId
					: null;
			if (targetId && messageMap.has(targetId)) {
				const msg = messageMap.get(targetId)!;
				msg.body = event.body;
				msg.isEdited = true;
				msg.editedAt =
					typeof event.content?.editedAt === "number"
						? event.content.editedAt
						: event.timestamp;
			}
			continue;
		}

		if (event.type === "message.delete") {
			const targetId =
				typeof event.content?.targetMessageId === "string"
					? event.content.targetMessageId
					: null;
			if (targetId && messageMap.has(targetId)) {
				const msg = messageMap.get(targetId)!;
				msg.isDeleted = true;
				msg.body = "";
			}
			continue;
		}

		if (event.type === "message.text") {
			const msg: ProjectedClientMessage = {
				id: event.id,
				roomId: event.roomId,
				senderId: event.senderId,
				displayName: event.displayName,
				body: event.body,
				timestamp: event.timestamp,
				sequenceId: event.sequenceId,
				isEdited: false,
				editedAt: null,
				isDeleted: false,
			};
			messageMap.set(event.id, msg);
			orderedIds.push(event.id);
		}
	}

	return orderedIds.map((id) => messageMap.get(id)!).filter(Boolean);
}

async function saveEditedMessage(
	messageId: string,
	body: string,
): Promise<void> {
	if (state.activeRoomId.length === 0) return;
	try {
		await api(
			`/api/rooms/${encodeURIComponent(state.activeRoomId)}/messages/${encodeURIComponent(messageId)}`,
			{
				method: "PATCH",
				body: JSON.stringify({
					body,
					senderId: state.userId,
					displayName: currentDisplayName(),
				}),
			},
		);
		state.editingMessageId = null;
		renderMessages();
	} catch (error) {
		console.error("Failed to edit message:", error);
	}
}

async function deleteMessage(messageId: string): Promise<void> {
	if (state.activeRoomId.length === 0) return;
	try {
		await api(
			`/api/rooms/${encodeURIComponent(state.activeRoomId)}/messages/${encodeURIComponent(messageId)}`,
			{
				method: "DELETE",
				body: JSON.stringify({
					senderId: state.userId,
				}),
			},
		);
	} catch (error) {
		console.error("Failed to delete message:", error);
	}
}

function renderMessages(): void {
	const events = state.eventsByRoom.get(state.activeRoomId) ?? [];
	const messages = projectRoomMessages(events);

	elements.messages.replaceChildren(
		...messages.map((message) => {
			const article = document.createElement("article");
			article.className = "message";
			article.dataset.mine = String(message.senderId === state.userId);

			const header = document.createElement("div");
			header.className = "message-header";

			const meta = document.createElement("div");
			meta.className = "message-meta";
			meta.textContent = `${message.displayName} - ${formatTime(message.timestamp)} - #${message.sequenceId}`;

			if (message.isEdited && !message.isDeleted) {
				const editedSpan = document.createElement("span");
				editedSpan.className = "edited-badge";
				editedSpan.textContent = "(edited)";
				meta.append(editedSpan);
			}

			header.append(meta);

			if (
				message.senderId === state.userId &&
				!message.isDeleted &&
				state.editingMessageId !== message.id
			) {
				const actions = document.createElement("div");
				actions.className = "message-actions";

				const editBtn = document.createElement("button");
				editBtn.type = "button";
				editBtn.className = "action-btn";
				editBtn.textContent = "Edit";
				editBtn.addEventListener("click", () => {
					state.editingMessageId = message.id;
					renderMessages();
				});

				const deleteBtn = document.createElement("button");
				deleteBtn.type = "button";
				deleteBtn.className = "action-btn delete-btn";
				deleteBtn.textContent = "Delete";
				deleteBtn.addEventListener("click", () => {
					void deleteMessage(message.id);
				});

				actions.append(editBtn, deleteBtn);
				header.append(actions);
			}

			article.append(header);

			if (message.isDeleted) {
				const deletedText = document.createElement("p");
				deletedText.className = "message-tombstone";
				deletedText.textContent = "This message was deleted";
				article.append(deletedText);
			} else if (state.editingMessageId === message.id) {
				const editForm = document.createElement("form");
				editForm.className = "edit-form";

				const editInput = document.createElement("input");
				editInput.type = "text";
				editInput.value = message.body;
				editInput.required = true;

				const actionsDiv = document.createElement("div");
				actionsDiv.className = "edit-form-actions";

				const cancelBtn = document.createElement("button");
				cancelBtn.type = "button";
				cancelBtn.className = "edit-cancel-btn";
				cancelBtn.textContent = "Cancel";
				cancelBtn.addEventListener("click", () => {
					state.editingMessageId = null;
					renderMessages();
				});

				const saveBtn = document.createElement("button");
				saveBtn.type = "submit";
				saveBtn.className = "edit-save-btn";
				saveBtn.textContent = "Save";

				actionsDiv.append(cancelBtn, saveBtn);
				editForm.append(editInput, actionsDiv);

				editForm.addEventListener("submit", (e) => {
					e.preventDefault();
					const newBody = editInput.value.trim();
					if (newBody.length === 0) return;
					void saveEditedMessage(message.id, newBody);
				});

				article.append(editForm);
				setTimeout(() => editInput.focus(), 0);
			} else {
				const body = document.createElement("p");
				body.textContent = message.body;
				article.append(body);
			}

			return article;
		}),
	);
	elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderActiveRoom(): void {
	const room = activeRoom();
	elements.roomTitle.textContent = room?.name ?? "No room selected";
	elements.roomTopic.textContent = room?.topic || "MessageWeave event stream";
	elements.joinButton.disabled = room === null;
	elements.messageBody.disabled = room === null;
	const submitButton =
		elements.messageForm.querySelector<HTMLButtonElement>("button");
	if (submitButton !== null) submitButton.disabled = room === null;
	renderRooms();
	renderMembers();
	renderMessages();
}

function mergeEvent(event: SerializedEvent): void {
	if (state.seenEventIds.has(event.id)) return;
	state.seenEventIds.add(event.id);

	const events = state.eventsByRoom.get(event.roomId) ?? [];
	events.push(event);
	events.sort((a, b) => a.sequenceId - b.sequenceId);
	state.eventsByRoom.set(event.roomId, events);

	if (event.type === "room.member") {
		const member = {
			userId: event.senderId,
			displayName:
				typeof event.content.displayName === "string"
					? event.content.displayName
					: event.senderId,
		};
		const members =
			state.membersByRoom
				.get(event.roomId)
				?.filter((item) => item.userId !== member.userId) ?? [];
		members.push(member);
		members.sort((a, b) => a.displayName.localeCompare(b.displayName));
		state.membersByRoom.set(event.roomId, members);
	}
}

async function selectRoom(roomId: string): Promise<void> {
	state.activeRoomId = roomId;
	const payload = await api<TimelineResponse>(
		`/api/rooms/${encodeURIComponent(roomId)}/timeline`,
	);
	const events = [...payload.events].sort(
		(a, b) => a.sequenceId - b.sequenceId,
	);
	state.eventsByRoom.set(roomId, events);
	state.membersByRoom.set(roomId, payload.members);
	for (const event of events) state.seenEventIds.add(event.id);
	renderActiveRoom();
}

function connectEvents(): void {
	const source = new EventSource("/api/events");
	source.addEventListener("open", () => setStatus("Live"));
	source.addEventListener("error", () => setStatus("Reconnecting"));
	source.addEventListener("message", (message) => {
		const payload = JSON.parse(message.data) as SsePayload;
		if (payload.type === "sync") {
			for (const event of payload.events) mergeEvent(event);
		}
		if (payload.type === "event") mergeEvent(payload.event);
		if (payload.type === "room.created") {
			mergeRoom(payload.room);
		}
		renderActiveRoom();
	});
}

elements.displayName.addEventListener("change", rememberDisplayName);

elements.roomForm.addEventListener("submit", (event) => {
	event.preventDefault();
	rememberDisplayName();
	const name = elements.roomName.value.trim();
	if (name.length === 0) return;
	elements.roomName.value = "";
	void api<RoomResponse>("/api/rooms", {
		method: "POST",
		body: JSON.stringify({
			creatorId: state.userId,
			name,
			topic: `${currentDisplayName()} created this room.`,
		}),
	}).then((payload) => {
		mergeRoom(payload.room);
		return selectRoom(payload.room.id);
	});
});

elements.joinButton.addEventListener("click", () => {
	if (state.activeRoomId.length === 0) return;
	rememberDisplayName();
	void api<JoinResponse>(
		`/api/rooms/${encodeURIComponent(state.activeRoomId)}/join`,
		{
			method: "POST",
			body: JSON.stringify({
				userId: state.userId,
				displayName: currentDisplayName(),
			}),
		},
	).then((payload) => {
		state.membersByRoom.set(state.activeRoomId, payload.members);
		renderActiveRoom();
	});
});

elements.messageForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (state.activeRoomId.length === 0) return;
	rememberDisplayName();
	const body = elements.messageBody.value.trim();
	if (body.length === 0) return;
	elements.messageBody.value = "";
	void api<{ event: SerializedEvent }>(
		`/api/rooms/${encodeURIComponent(state.activeRoomId)}/messages`,
		{
			method: "POST",
			body: JSON.stringify({
				senderId: state.userId,
				displayName: currentDisplayName(),
				body,
			}),
		},
	);
});

async function boot(): Promise<void> {
	const payload = await api("/api/bootstrap");
	state.rooms = payload.rooms;
	state.rooms.sort((a, b) => a.name.localeCompare(b.name));
	if (state.rooms[0]) await selectRoom(state.rooms[0].id);
	connectEvents();
}

boot().catch((error: unknown) => {
	console.error(error);
	setStatus("Offline");
});
