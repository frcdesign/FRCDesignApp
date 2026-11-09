/**
 * The owner's testbench: one Onshape call at a time, made as the owner, for
 * exploring endpoints and the rate limits Onshape reports for them.
 */
import { getApp } from "../../lib/context";
import { onshapeUrl } from "../../lib/onshape/client";
import { validate } from "../../lib/validate";
import { requireOwnerMiddleware } from "../auth/guards";
import {
    MAX_BODY_CHARS,
    onshapeCallBody,
    type OnshapeCallResult
} from "./contract";

export const testbenchRoutes = getApp();

/** POST /api/testbench/onshape: Onshape's answer, whatever its status. */
testbenchRoutes.post(
    "/testbench/onshape",
    requireOwnerMiddleware,
    validate("json", onshapeCallBody),
    async (c) => {
        const { method, version, path, query, body } = c.req.valid("json");
        const client = await c.var.getOnshapeApi();
        const started = performance.now();
        const response = await client.send(method, path, {
            version,
            query,
            body
        });
        const text = await response.text();
        const durationMs = Math.round(performance.now() - started);

        const truncated = text.length > MAX_BODY_CHARS;
        const result: OnshapeCallResult = {
            url: onshapeUrl(path, { version, query }),
            status: response.status,
            durationMs,
            headers: Object.fromEntries(response.headers),
            body: parseBody(text.slice(0, MAX_BODY_CHARS)),
            truncated
        };
        return c.json(result);
    }
);

function parseBody(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}
