/** The app's one WebSocket to the server's pushes. Reconnects with backoff; `live-sync.ts` catches up after. */
import {
    LIVE_LIBRARY_PARAM,
    LIVE_PATH,
    type LiveMessage
} from "@backend/features/live/contract";
import type { LibraryId } from "@backend/features/library/library-id";

type MessageListener = (message: LiveMessage) => void;
type ConnectionListener = () => void;

const FIRST_RETRY_MS = 1_000;
const LAST_RETRY_MS = 30_000;

const messageListeners = new Set<MessageListener>();
const connectionListeners = new Set<ConnectionListener>();

let socket: WebSocket | undefined;
let connected = false;
let retryMs = FIRST_RETRY_MS;
let retryTimer: number | undefined;

function setConnected(next: boolean): void {
    if (connected === next) {
        return;
    }
    connected = next;
    connectionListeners.forEach((listener) => listener());
}

function liveUrl(libraryId: LibraryId): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const query = new URLSearchParams({ [LIVE_LIBRARY_PARAM]: libraryId });
    return `${protocol}//${window.location.host}${LIVE_PATH}?${query.toString()}`;
}

function open(libraryId: LibraryId): void {
    const current = new WebSocket(liveUrl(libraryId));
    socket = current;
    current.onopen = () => {
        retryMs = FIRST_RETRY_MS;
        setConnected(true);
    };
    current.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as LiveMessage;
        messageListeners.forEach((listener) => listener(message));
    };
    current.onclose = () => {
        // A socket this module already let go of, which it closed itself.
        if (socket !== current) {
            return;
        }
        socket = undefined;
        setConnected(false);
        retryTimer = window.setTimeout(() => open(libraryId), retryMs);
        retryMs = Math.min(retryMs * 2, LAST_RETRY_MS);
    };
}

/** Connects for `libraryId`, dropping any connection for another; returns a disconnect. */
export function connectLiveUpdates(libraryId: LibraryId): () => void {
    open(libraryId);
    return () => {
        window.clearTimeout(retryTimer);
        const current = socket;
        socket = undefined;
        current?.close();
        setConnected(false);
    };
}

export function subscribeLiveMessages(listener: MessageListener): () => void {
    messageListeners.add(listener);
    return () => messageListeners.delete(listener);
}

export function subscribeLiveConnection(
    listener: ConnectionListener
): () => void {
    connectionListeners.add(listener);
    return () => connectionListeners.delete(listener);
}

export function isLiveConnected(): boolean {
    return connected;
}
