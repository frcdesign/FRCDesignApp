import z from "zod";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { Hint } from "./contract";
import { markHintSeen } from "./store";

export const hintRoutes = getApp();

/** POST /api/seen-hints: sent once the hinted feature has been opened. */
hintRoutes.post(
    "/seen-hints",
    requireSignInMiddleware,
    validate("json", z.object({ hint: z.enum(Hint) })),
    async (c) => {
        await markHintSeen(c, c.req.valid("json").hint);
        return c.json({});
    }
);
