import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { handledError } from "../../lib/api-error";
import { type AppContext, getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { getCatalog, Program } from "./catalog";
import {
    FastenerMode,
    type QuickFastenerIn,
    type QuickFastenerInsertOut,
    type QuickFastenerPlan,
    SelectedEntityType
} from "./contract";
import { gather } from "./gather";
import { insertFasteners } from "./insert";
import { planHoles } from "./planner";
import { DETERMINISTIC_ID } from "./scan";

export const quickFastenerRoutes = getApp();

/** More than anyone picks by hand; each is scanned and fastened. */
const MAX_SELECTIONS = 200;

/** Inches: the longest standard screw. */
const MAX_LENGTH_LIMIT = 10 * 0.0254;

const entitySchema = z.object({
    occurrencePath: z.array(z.string().min(1)).min(1),
    entityId: z.string().regex(DETERMINISTIC_ID),
    entityType: z.enum(SelectedEntityType)
});

const bodySchema = z.object({
    /** An assembly in a workspace: fasteners are only ever added to one. */
    assembly: z.object({
        documentId: z.string().min(1),
        instanceId: z.string().min(1),
        instanceType: z.literal("w"),
        elementId: z.string().min(1)
    }),
    targets: z.array(entitySchema).min(1).max(MAX_SELECTIONS),
    excluded: z.array(entitySchema).max(MAX_SELECTIONS).default([]),
    options: z.object({
        program: z.enum(Program),
        mode: z.enum(FastenerMode),
        vendor: z.string().min(1),
        head: z.string().min(1),
        size: z.string().optional(),
        length: z.string().optional(),
        headWasher: z.boolean(),
        nutType: z.string().optional(),
        nutWasher: z.boolean(),
        maxLength: z.number().positive().max(MAX_LENGTH_LIMIT),
        upToNext: z.boolean()
    })
});

async function plan(c: AppContext, body: QuickFastenerIn) {
    if (!getCatalog(body.options.program)) {
        throw handledError(
            "Quick fastener doesn't have FTC fasteners yet.",
            HttpStatus.BAD_REQUEST
        );
    }
    const client = await c.var.getOnshapeApi();
    const gathered = await gather(
        client,
        c.env.KV,
        body.assembly,
        body.targets,
        body.excluded
    );
    return {
        client,
        plans: planHoles(
            gathered.circles,
            gathered.holes,
            gathered.placed,
            body.options
        )
    };
}

/** POST /api/quick-fastener/plan — the fastener each picked hole would get. */
quickFastenerRoutes.post(
    "/quick-fastener/plan",
    requireSignInMiddleware,
    validate("json", bodySchema),
    async (c) => {
        const { plans } = await plan(c, c.req.valid("json"));
        return c.json({
            holes: plans.map((each) => each.planned)
        } satisfies QuickFastenerPlan);
    }
);

/** POST /api/quick-fastener/insert — plans again, then inserts and fastens every hole that's ready. */
quickFastenerRoutes.post(
    "/quick-fastener/insert",
    requireSignInMiddleware,
    validate("json", bodySchema),
    async (c) => {
        const body = c.req.valid("json");
        const { client, plans } = await plan(c, body);
        const inserted = await insertFasteners(
            client,
            c.env.KV,
            body.assembly,
            plans
        );
        return c.json({ inserted } satisfies QuickFastenerInsertOut);
    }
);
