import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { type Db, getDb } from "../../db/client";
import { Program } from "./catalog";
import {
    AssemblyJobState,
    FastenerMode,
    type AssemblyJobStatus,
    pendingTasks,
    SelectionMode,
    StopCondition
} from "./contract";
import { getFastenerSet } from "./fastener-set";
import { getJobStatus, reportJob } from "./jobs";
import {
    entitySchema,
    INCONSISTENT_PICK_MESSAGE,
    isConsistentPick,
    MAX_SELECTIONS
} from "./picked";
import {
    FastenerKind,
    type FastenerSet,
    isMade,
    type PartChoice,
    type ScrewChoice
} from "./studios";

export const autoAssemblyRoutes = getApp();

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

function isEveryPartMade(
    set: FastenerSet,
    options: {
        screw: ScrewChoice;
        screwWasher?: PartChoice;
        nut?: PartChoice;
        nutWasher?: PartChoice;
    }
): boolean {
    const parts: [FastenerKind, PartChoice | undefined][] = [
        [FastenerKind.WASHER, options.screwWasher],
        [FastenerKind.NUT, options.nut],
        [FastenerKind.WASHER, options.nutWasher]
    ];
    return (
        isMade(set, FastenerKind.SCREW, options.screw) &&
        parts.every(
            ([kind, part]) =>
                !part ||
                (part.size === options.screw.size && isMade(set, kind, part))
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
        maxLength: z.number().positive().max(MAX_LENGTH_LIMIT).optional(),
        maxGap: z.number().min(0).max(MAX_GAP_LIMIT),
        maxThreadDepth: z.number().positive().max(MAX_LENGTH_LIMIT)
    })
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

/** POST /api/auto-assembly/insert — starts a run fastening the picked holes. */
autoAssemblyRoutes.post(
    "/auto-assembly/insert",
    requireSignInMiddleware,
    validate("json", insertBody),
    async (c) => {
        const request = c.req.valid("json");
        if (request.options.program !== Program.FRC) {
            throw handledError(
                "Auto Assembly doesn't have FTC fasteners yet.",
                HttpStatus.BAD_REQUEST
            );
        }
        // Refused before a run starts, rather than by its insert step
        const set = await requireFastenerSet(getDb(c.env.DB));
        if (!isEveryPartMade(set, request.options)) {
            throw handledError(
                "Every part must be one its vendor makes, in the screw's size.",
                HttpStatus.BAD_REQUEST
            );
        }
        const current = await getJobStatus(c.env, request.assembly);
        if (current.state === AssemblyJobState.RUNNING) {
            throw handledError(
                "Fasteners are already being inserted in this assembly.",
                HttpStatus.CONFLICT
            );
        }

        const run = await c.env.AUTO_ASSEMBLY_WORKFLOW.create({
            params: {
                sessionId: getSessionId(c),
                userId: await c.var.getUserId(),
                request
            }
        });
        const status: AssemblyJobStatus = {
            state: AssemblyJobState.RUNNING,
            jobId: run.id,
            tasks: pendingTasks(),
            result: { inserted: 0, fastened: 0 }
        };
        await reportJob(c.env, request.assembly, status);
        return c.json(status);
    }
);

async function requireFastenerSet(db: Db): Promise<FastenerSet> {
    const set = await getFastenerSet(db);
    if (!set) {
        throw handledError(
            "Auto Assembly's parts aren't published yet.",
            HttpStatus.SERVICE_UNAVAILABLE
        );
    }
    return set;
}

/** GET /api/auto-assembly/parts — the fasteners the library loaded, their catalog and studios; null before it loads them. */
autoAssemblyRoutes.get("/auto-assembly/parts", async (c) =>
    c.json((await getFastenerSet(getDb(c.env.DB))) ?? null)
);

/** GET /api/auto-assembly/job?documentId=&instanceId=&elementId= — the run this assembly last started. */
autoAssemblyRoutes.get(
    "/auto-assembly/job",
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
