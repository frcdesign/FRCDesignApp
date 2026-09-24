/**
 * Holds every client's WebSocket and relays pushes. One instance for the app,
 * since pushes are few and small. Sockets hibernate, so idle clients cost
 * nothing, and are tagged with the library they show.
 */
import { DurableObject } from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import type { LibraryId } from "../library/library-id";
import { LIVE_LIBRARY_PARAM, type LiveMessage } from "./contract";

export class LiveUpdates extends DurableObject<AppBindings> {
    fetch(request: Request): Response {
        const libraryId = new URL(request.url).searchParams.get(
            LIVE_LIBRARY_PARAM
        );
        const { 0: client, 1: server } = new WebSocketPair();
        this.ctx.acceptWebSocket(server, libraryId ? [libraryId] : []);
        return new Response(null, { status: 101, webSocket: client });
    }

    /** To the clients showing `libraryId`, or to every client without one. */
    broadcast(message: LiveMessage, libraryId?: LibraryId): void {
        const data = JSON.stringify(message);
        for (const socket of this.ctx.getWebSockets(libraryId)) {
            try {
                socket.send(data);
            } catch {
                // Closing already; its client reconnects and resyncs.
            }
        }
    }
}
