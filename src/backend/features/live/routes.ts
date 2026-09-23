import { HttpStatus } from "http-status-ts";
import { getApp } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { LIVE_PATH } from "./contract";

export const liveRoutes = getApp();

/**
 * GET /api/live?library= — a WebSocket of what the server pushes. Open to
 * anyone, since nothing sent over it is private (see `contract.ts`).
 */
liveRoutes.get(LIVE_PATH.replace(/^\/api/, ""), (c) => {
    if (c.req.header("Upgrade") !== "websocket") {
        throw handledError(
            "Expected a WebSocket upgrade",
            HttpStatus.UPGRADE_REQUIRED
        );
    }
    return c.env.LIVE_UPDATES.getByName("all").fetch(c.req.raw);
});
