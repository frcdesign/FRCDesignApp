/** The app's one WebSocket to the server's pushes. Reconnects with backoff; `push-sync.ts` catches up after. */
import {
    PUSH_LIBRARY_PARAM,
    PUSH_ROUTE,
    PUSH_WORKSPACE_PARAM,
    type PushMessage
} from "@backend/features/push/contract";
import type { LibraryId } from "@backend/features/library/library-id";

/** What the socket is tagged with: the library shown, and the workspace the
 * app was launched in, if any. */
export interface PushScope {
    libraryId: LibraryId;
    workspaceKey?: string;
}

type MessageListener = (message: PushMessage) => void;
type ConnectionListener = (connected: boolean) => void;

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
    connectionListeners.forEach((listener) => listener(next));
}

function pushUrl(scope: PushScope): string {
    const url = new URL("/api" + PUSH_ROUTE, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set(PUSH_LIBRARY_PARAM, scope.libraryId);
    if (scope.workspaceKey) {
        url.searchParams.set(PUSH_WORKSPACE_PARAM, scope.workspaceKey);
    }
    return url.href;
}

function open(scope: PushScope): void {
    const current = new WebSocket(pushUrl(scope));
    socket = current;
    current.onopen = () => {
        retryMs = FIRST_RETRY_MS;
        setConnected(true);
    };
    current.onmessage = (event: MessageEvent<string>) => {
        // Sent by our own server, in the contract's shape.
        const message = JSON.parse(event.data) as PushMessage;
        messageListeners.forEach((listener) => listener(message));
    };
    current.onclose = () => {
        // A socket this module already let go of, which it closed itself.
        if (socket !== current) {
            return;
        }
        socket = undefined;
        setConnected(false);
        retryTimer = window.setTimeout(() => open(scope), retryMs);
        retryMs = Math.min(retryMs * 2, LAST_RETRY_MS);
    };
}

/** Connects for `scope`, dropping any connection for another; returns a disconnect. */
export function connectPushes(scope: PushScope): () => void {
    open(scope);
    return () => {
        window.clearTimeout(retryTimer);
        const current = socket;
        socket = undefined;
        current?.close();
        setConnected(false);
    };
}

export function subscribePushes(listener: MessageListener): () => void {
    messageListeners.add(listener);
    return () => messageListeners.delete(listener);
}

export function subscribePushConnection(
    listener: ConnectionListener
): () => void {
    connectionListeners.add(listener);
    return () => connectionListeners.delete(listener);
}
