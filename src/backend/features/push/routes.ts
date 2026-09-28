import { HttpStatus } from "http-status-ts";
import { getApp } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { PUSH_ROUTE } from "./contract";
import { getPushHub } from "./push-hub";

export const pushRoutes = getApp();

/** GET /api/push?library=: open to anyone, since nothing pushed is private. */
pushRoutes.get(PUSH_ROUTE, (c) => {
    if (c.req.header("Upgrade") !== "websocket") {
        throw handledError(
            "Expected a WebSocket upgrade",
            HttpStatus.UPGRADE_REQUIRED
        );
    }
    return getPushHub(c.env).fetch(c.req.raw);
});
