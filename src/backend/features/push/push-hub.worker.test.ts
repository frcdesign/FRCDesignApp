import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../__test_utils__";
import { LibraryId } from "../library/library-id";
import { PUSH_ROUTE, type PushMessage, PushType } from "./contract";
import { getPushHub } from "./push-hub";

/** A client connected for `libraryId`, collecting what it is sent. */
async function connect(libraryId: LibraryId) {
    const res = await createTestApp().request(
        `/api${PUSH_ROUTE}?library=${libraryId}`,
        { headers: { Upgrade: "websocket" } },
        env
    );
    expect(res.status).toBe(101);
    const socket = res.webSocket;
    if (!socket) {
        throw new Error("No WebSocket in the upgrade response");
    }
    socket.accept();
    const received: PushMessage[] = [];
    socket.addEventListener("message", (event) => {
        received.push(JSON.parse(event.data as string) as PushMessage);
    });
    return { socket, received };
}

/** Lets a message cross from the Durable Object to its sockets. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("the push hub", () => {
    it("wants a WebSocket upgrade", async () => {
        const res = await createTestApp().request(`/api${PUSH_ROUTE}`, {}, env);
        expect(res.status).toBe(426);
    });

    it("sends a library's messages to its viewers alone", async () => {
        const frc = await connect(LibraryId.FRC_DESIGN_LIB);
        const ftc = await connect(LibraryId.FTC_DESIGN_LIB);
        const message: PushMessage = {
            type: PushType.LIBRARY,
            libraryId: LibraryId.FRC_DESIGN_LIB
        };

        await getPushHub(env).broadcast(message);
        await settle();

        expect(frc.received).toEqual([message]);
        expect(ftc.received).toEqual([]);
        frc.socket.close();
        ftc.socket.close();
    });

    it("sends a message for no library to everyone", async () => {
        const frc = await connect(LibraryId.FRC_DESIGN_LIB);
        const ftc = await connect(LibraryId.FTC_DESIGN_LIB);

        const message: PushMessage = {
            type: PushType.THUMBNAIL,
            elementId: "e1",
            microversionId: "mv1",
            configurationKey: ""
        };
        await getPushHub(env).broadcast(message);
        await settle();

        expect(frc.received).toEqual([message]);
        expect(ftc.received).toEqual([message]);
        frc.socket.close();
        ftc.socket.close();
    });
});
