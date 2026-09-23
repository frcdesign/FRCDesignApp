import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../__test_utils__";
import { LibraryId } from "../library/library-id";
import { LIVE_PATH, type LiveMessage, LiveMessageType } from "./contract";

/** A client connected for `libraryId`, collecting what it is sent. */
async function connect(libraryId: LibraryId) {
    const res = await createTestApp().request(
        `${LIVE_PATH}?library=${libraryId}`,
        { headers: { Upgrade: "websocket" } },
        env
    );
    expect(res.status).toBe(101);
    const socket = res.webSocket;
    if (!socket) {
        throw new Error("No WebSocket in the upgrade response");
    }
    socket.accept();
    const received: LiveMessage[] = [];
    socket.addEventListener("message", (event) => {
        received.push(JSON.parse(event.data as string) as LiveMessage);
    });
    return { socket, received };
}

/** Lets a message cross from the Durable Object to its sockets. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const stub = () => env.LIVE_UPDATES.getByName("all");

describe("live updates", () => {
    it("wants a WebSocket upgrade", async () => {
        const res = await createTestApp().request(LIVE_PATH, {}, env);
        expect(res.status).toBe(426);
    });

    it("sends a library's messages to its viewers alone", async () => {
        const frc = await connect(LibraryId.FRC_DESIGN_LIB);
        const ftc = await connect(LibraryId.FTC_DESIGN_LIB);
        const message: LiveMessage = {
            type: LiveMessageType.LIBRARY,
            libraryId: LibraryId.FRC_DESIGN_LIB
        };

        await stub().broadcast(message, LibraryId.FRC_DESIGN_LIB);
        await settle();

        expect(frc.received).toEqual([message]);
        expect(ftc.received).toEqual([]);
        frc.socket.close();
        ftc.socket.close();
    });

    it("sends a message for no library to everyone", async () => {
        const frc = await connect(LibraryId.FRC_DESIGN_LIB);
        const ftc = await connect(LibraryId.FTC_DESIGN_LIB);

        await stub().broadcast({ type: LiveMessageType.ACCESS });
        await settle();

        expect(frc.received).toEqual([{ type: LiveMessageType.ACCESS }]);
        expect(ftc.received).toEqual([{ type: LiveMessageType.ACCESS }]);
        frc.socket.close();
        ftc.socket.close();
    });
});
