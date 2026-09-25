/**
 * Holds every client's WebSocket and relays pushes. One instance for the app,
 * since pushes are few and small. Sockets hibernate, so idle clients cost
 * nothing, and are tagged with the library they show.
 */
import { DurableObject } from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import { LibraryId } from "../library/library-id";
import { PUSH_LIBRARY_PARAM, type PushMessage, PushType } from "./contract";

export class PushHub extends DurableObject<AppBindings> {
    fetch(request: Request): Response {
        const libraryId = new URL(request.url).searchParams.get(
            PUSH_LIBRARY_PARAM
        );
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(
            server,
            isLibraryId(libraryId) ? [libraryId] : []
        );
        return new Response(null, { status: 101, webSocket: client });
    }

    /** A library's message to the clients showing it; any other to every client. */
    broadcast(message: PushMessage): void {
        const tag =
            message.type === PushType.THUMBNAIL ? undefined : message.libraryId;
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

function isLibraryId(value: string | null): value is LibraryId {
    return Object.values<string | null>(LibraryId).includes(value);
}

/** The one instance every client connects to. */
export function getPushHub(env: AppBindings) {
    return env.PUSH_HUB.getByName("all");
}
