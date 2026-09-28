/**
 * Holds every client's WebSocket and relays pushes. One instance for the app,
 * since pushes are few and small. Sockets hibernate, so idle clients cost
 * nothing, and are tagged with the library they show.
 */
import { DurableObject } from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import { LibraryId } from "../library/library-id";
import {
    PUSH_LIBRARY_PARAM,
    PUSH_WORKSPACE_PARAM,
    type PushMessage,
    PushType
} from "./contract";

export class PushHub extends DurableObject<AppBindings> {
    fetch(request: Request): Response {
        const params = new URL(request.url).searchParams;
        const libraryId = params.get(PUSH_LIBRARY_PARAM);
        const workspaceKey = params.get(PUSH_WORKSPACE_PARAM);
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server, [
            ...(isLibraryId(libraryId) ? [libraryId] : []),
            // The Onshape workspace this client was launched in, so a push or
            // pull started there reaches the people in it and nobody else.
            ...(workspaceKey ? [workspaceKey] : [])
        ]);
        return new Response(null, { status: 101, webSocket: client });
    }

    /** To the clients tagged with what the message is about, or to all. */
    broadcast(message: PushMessage): void {
        const tag = toTag(message);
        const data = JSON.stringify(message);
        for (const socket of this.ctx.getWebSockets(tag)) {
            try {
                socket.send(data);
            } catch {
                // Closing already; its client reconnects and resyncs.
            }
        }
    }
}

/** Which sockets a message is for; undefined is every one of them. */
function toTag(message: PushMessage): string | undefined {
    switch (message.type) {
        case PushType.THUMBNAIL:
            return undefined;
        case PushType.VERSION_JOB:
            return message.workspaceKey;
        default:
            return message.libraryId;
    }
}

function isLibraryId(value: string | null): value is LibraryId {
    return Object.values<string | null>(LibraryId).includes(value);
}

/** The one instance every client connects to. */
export function getPushHub(env: AppBindings) {
    return env.PUSH_HUB.getByName("all");
}
