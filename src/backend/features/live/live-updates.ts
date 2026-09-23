/**
 * Holds every open client's WebSocket and relays what the server pushes. One
 * instance for the whole app: the pushes are few and small, and one place to
 * send them keeps a sender from having to know who is listening where.
 *
 * Sockets are accepted for hibernation, so an idle instance costs nothing
 * while its clients stay connected; each is tagged with the library its client
 * shows, which is what a library's messages are sent to.
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
