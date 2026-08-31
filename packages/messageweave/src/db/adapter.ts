import type { MessageWeaveOptions } from "../options";
import type { MessageWeaveStorage } from "../storage";

export type FlowAdapter = MessageWeaveStorage;

/** Build the MessageWeave storage adapter from user options. */
export function createFlowAdapter(options: MessageWeaveOptions): FlowAdapter {
	return options.storage;
}
