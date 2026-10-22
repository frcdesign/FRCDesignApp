import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { getCatalog, Program } from "./catalog";
import {
    FastenerJobState,
    FastenerMode,
    type FastenerJobStatus,
    pendingTasks,
    SelectionMode,
    StopCondition
} from "./contract";
import { studioLocation } from "./insert";
import { getJobStatus, reportJob } from "./jobs";
import {
    entitySchema,
    INCONSISTENT_PICK_MESSAGE,
    isConsistentPick,
    MAX_SELECTIONS
} from "./picked";
import {
    FastenerKind,
    isMade,
    type PartChoice,
    type ScrewChoice
} from "./studios";

export const quickFastenerRoutes = getApp();

/** Inches: the longest standard screw, and a gap wider than any worth ignoring. */
const MAX_LENGTH_LIMIT = 10 * 0.0254;
const MAX_GAP_LIMIT = 1 * 0.0254;

const optionId = z.string().min(1);

const screwSchema = z.object({
    vendor: optionId,
    size: optionId,
    head: optionId,
    finish: optionId,
    length: optionId,
    fullyThreaded: z.enum(["true", "false"])
});

/** A washer or nut. */
const partSchema = z.object({
    vendor: optionId,
    size: optionId,
    type: optionId,
    finish: optionId.optional()
});

function isEveryPartMade(options: {
    screw: ScrewChoice;
    screwWasher?: PartChoice;
    nut?: PartChoice;
    nutWasher?: PartChoice;
}): boolean {
    const parts: [FastenerKind, PartChoice | undefined][] = [
        [FastenerKind.WASHER, options.screwWasher],
        [FastenerKind.NUT, options.nut],
        [FastenerKind.WASHER, options.nutWasher]
    ];
    return (
        isMade(FastenerKind.SCREW, options.screw) &&
        parts.every(
            ([kind, part]) =>
                !part ||
                (part.size === options.screw.size && isMade(kind, part))
        )
    );
}

const optionsSchema = z
    .object({
        program: z.enum(Program),
        mode: z.enum(FastenerMode),
        screw: screwSchema,
        screwWasher: partSchema.optional(),
        nut: partSchema.optional(),
        nutWasher: partSchema.optional(),
        stop: z.enum(StopCondition),
        maxLength: z.number().positive().max(MAX_LENGTH_LIMIT),
        maxGap: z.number().min(0).max(MAX_GAP_LIMIT),
        maxThreadDepth: z.number().positive().max(MAX_LENGTH_LIMIT),
        replicate: z.boolean()
    })
    .refine(
        isEveryPartMade,
        "Every part must be one its vendor makes, in the screw's size."
    )
    .refine(
        (options) => !options.nutWasher || options.nut,
        "A nut washer goes under a nut."
    );

/** An assembly in a workspace: fasteners are only ever added to one. */
const assemblySchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.literal("w"),
    elementId: z.string().min(1)
});

const insertBody = z
    .object({
        assembly: assemblySchema,
        selectionMode: z.enum(SelectionMode),
        targets: z.array(entitySchema).min(1).max(MAX_SELECTIONS),
        excluded: z.array(entitySchema).max(MAX_SELECTIONS).default([]),
        options: optionsSchema
    })
    .refine(isConsistentPick, INCONSISTENT_PICK_MESSAGE);

const assemblyQuery = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    elementId: z.string().min(1)
});

/** POST /api/quick-fastener/insert — starts a run fastening the picked holes. */
quickFastenerRoutes.post(
    "/quick-fastener/insert",
    requireSignInMiddleware,
    validate("json", insertBody),
    async (c) => {
        const request = c.req.valid("json");
        if (!getCatalog(request.options.program)) {
            throw handledError(
                "Quick fastener doesn't have FTC fasteners yet.",
                HttpStatus.BAD_REQUEST
            );
        }
        // Refused before a run starts, rather than by its insert step
        for (const kind of Object.values(FastenerKind)) {
            studioLocation(kind);
        }
        const current = await getJobStatus(c.env, request.assembly);
        if (current.state === FastenerJobState.RUNNING) {
            throw handledError(
                "Fasteners are already being inserted in this assembly.",
                HttpStatus.CONFLICT
            );
        }

        const run = await c.env.QUICK_FASTENER_WORKFLOW.create({
            params: { sessionId: getSessionId(c), request }
        });
        const status: FastenerJobStatus = {
            state: FastenerJobState.RUNNING,
            jobId: run.id,
            tasks: pendingTasks(request.options),
            result: { inserted: 0, fastened: 0, replicated: 0 }
        };
        await reportJob(c.env, request.assembly, status);
        return c.json(status);
    }
);

/** GET /api/quick-fastener/job?documentId=&instanceId=&elementId= — the run this assembly last started. */
quickFastenerRoutes.get(
    "/quick-fastener/job",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", assemblyQuery),
    async (c) => {
        const query = c.req.valid("query");
        return c.json(
            await getJobStatus(c.env, { ...query, instanceType: "w" })
        );
    }
);
