import { MessageWeaveError } from "../utils/validate";
import type { FlowAdapter } from "./adapter";

const SEQUENCE_NAME = "global";

/**
 * Assigns strictly-increasing `sequenceId` values for the event timeline.
 *
 * Uses Optimistic Concurrency Control (Compare-And-Swap) backed by `unadapter`'s
 * conditional `update` queries with exponential backoff and jitter. This ensures
 * monotonic, collision-free sequence numbers across multiple concurrent node
 * processes or serverless instances sharing the same database storage.
 */
export function createSequencer(adapter: FlowAdapter) {
	let tail: Promise<unknown> = Promise.resolve();

	async function bump(): Promise<number> {
		const maxRetries = 100;
		const baseDelayMs = 2;
		const maxDelayMs = 50;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const current = await adapter.findOne({
				model: "sequence",
				where: [{ field: "name", value: SEQUENCE_NAME }],
			});

			if (!current) {
				try {
					await adapter.create({
						model: "sequence",
						data: { name: SEQUENCE_NAME, value: 1 },
					});
					return 1;
				} catch {
					// Another process created the initial row concurrently; retry
					continue;
				}
			}

			const currentVal = Number(current.value);
			const nextVal = currentVal + 1;

			const updated = await adapter.update({
				model: "sequence",
				where: [
					{ field: "name", value: SEQUENCE_NAME },
					{ field: "value", value: currentVal },
				],
				update: { value: nextVal },
			});

			if (updated) {
				return nextVal;
			}

			// CAS conflict: another process incremented the sequence before us.
			// Apply exponential backoff with random jitter before retrying.
			const delay = Math.min(
				maxDelayMs,
				baseDelayMs * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 5,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		throw new MessageWeaveError(
			`Failed to allocate sequence ID after ${maxRetries} CAS attempts due to contention`,
		);
	}

	/**
	 * Run `task` with the next sequence id, serialized within this process
	 * and protected by database CAS across multiple processes.
	 */
	function withNextSequence<T>(
		task: (sequenceId: number) => Promise<T>,
	): Promise<T> {
		const run = tail.then(async () => {
			const sequenceId = await bump();
			return task(sequenceId);
		});
		// Keep the queue alive regardless of whether this task resolves or rejects.
		tail = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	return { withNextSequence };
}

export type Sequencer = ReturnType<typeof createSequencer>;
