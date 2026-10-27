import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { ApiError } from "../../lib/api-error";
import type { AppBindings } from "../../lib/context";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    addAssemblyFeature,
    insertTransformedInstances
} from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import { ONSHAPE_STEP_RETRIES } from "../load/steps";
import { getDb } from "../../db/client";
import { isRateLimited, isTransient } from "../../lib/onshape/failures";
import {
    FastenerJobState,
    FastenerTaskAction,
    FastenerTaskState,
    type FastenerJobResult,
    type FastenerJobStatus,
    type FastenerTask,
    type PlannedHole,
    pendingTasks,
    type QuickFastenerIn
} from "./contract";
import {
    describeRunFailure,
    describeStepFailure,
    runFailure
} from "./failures";
import { getFastenerSet } from "./fastener-set";
import { type FastenerSet } from "./studios";
import { indexHoles } from "./index-holes";
import {
    insertGroups,
    type PartPlacement,
    partMate,
    namePlacements,
    placements,
    washerTopEdges
} from "./insert";
import { reportJob } from "./jobs";
import { planHoles } from "./planner";

export interface FastenerJobParams {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    request: QuickFastenerIn;
}

/** One run, shared by the steps that report on it. */
interface RunContext {
    env: AppBindings;
    step: WorkflowStep;
    sessionId: string;
    assembly: ElementPath;
    tasks: FastenerTask[];
    holes?: PlannedHole[];
    result: FastenerJobResult;
    status: (state: FastenerJobState) => FastenerJobStatus;
}

type StepRunner = <T extends Rpc.Serializable<T>>(
    name: string,
    retryable: (error: unknown) => boolean,
    callback: (client: OnshapeApi) => Promise<T>
) => Promise<T>;

/**
 * Inserts fasteners in an assembly: reads its holes and plans each picked one,
 * inserts every part, then fastens each where it sits. Each Onshape call is a
 * step of its own; a write is tried again only when Onshape refused it before
 * doing anything, so a retry never inserts or mates twice.
 */
export class QuickFastenerWorkflow extends WorkflowEntrypoint<
    AppBindings,
    FastenerJobParams
> {
    async run(
        event: WorkflowEvent<FastenerJobParams>,
        step: WorkflowStep
    ): Promise<FastenerJobResult> {
        const { sessionId, request } = event.payload;
        const tasks: FastenerTask[] = pendingTasks();
        const ctx: RunContext = {
            env: this.env,
            step,
            sessionId,
            assembly: request.assembly,
            tasks,
            result: { inserted: 0, fastened: 0 },
            status: (state) => ({
                state,
                jobId: event.instanceId,
                tasks,
                ...(ctx.holes ? { holes: ctx.holes } : {}),
                result: ctx.result
            })
        };

        let error: unknown;
        try {
            await runSteps(ctx, request);
        } catch (thrown) {
            error = thrown;
        }
        await step.do("finish-job", () =>
            reportJob(this.env, request.assembly, {
                ...ctx.status(
                    error ? FastenerJobState.FAILED : FastenerJobState.COMPLETE
                ),
                ...(error ? { error: describeRunFailure(error) } : {}),
                finishedAt: Date.now()
            })
        );
        return ctx.result;
    }
}

async function runSteps(ctx: RunContext, request: QuickFastenerIn) {
    // As loaded when the run started, though the library reloads during it
    const set = await ctx.step.do(
        "fastener-set",
        async () => (await getFastenerSet(getDb(ctx.env.DB))) ?? null
    );
    if (!set) {
        throw runFailure("Quick fastener's parts aren't published yet.");
    }
    const indexed = await runTask(ctx, FastenerTaskAction.INDEX, (run) =>
        run("index", isTransient, async (client) => {
            const indexed = await indexHoles(
                client,
                ctx.env.KV,
                request.assembly,
                request.targets,
                request.excluded,
                set
            );
            return {
                plans: planHoles(
                    indexed.circularEdges,
                    indexed.holes,
                    indexed.placed,
                    request.options,
                    set.catalog
                ),
                unfound: indexed.unfound
            };
        })
    );
    if (!indexed) {
        skipRest(ctx);
        return;
    }
    const { plans } = indexed;
    ctx.holes = [...plans.map((plan) => plan.planned), ...indexed.unfound];

    // Named as the studios' records name each configuration, for its mates
    const parts = await ctx.step.do("part-names", () =>
        namePlacements(getDb(ctx.env.DB), set, placements(set, plans))
    );
    if (parts.length === 0) {
        skipRest(ctx);
        return;
    }
    const paths = await runTask(ctx, FastenerTaskAction.INSERT, (run) =>
        insertParts(ctx, set, run, parts)
    );
    if (!paths) {
        skipRest(ctx);
        return;
    }
    await runTask(ctx, FastenerTaskAction.FASTEN, (run) =>
        fastenParts(ctx, set, run, parts, paths)
    );
}

/** Inserts parts in one call: each one's occurrence path, or null where Onshape answered none. */
async function insertParts(
    ctx: RunContext,
    set: FastenerSet,
    run: StepRunner,
    parts: PartPlacement[]
): Promise<(string[] | null)[]> {
    const paths = await run("insert", isRateLimited, async (client) => {
        const response = await insertTransformedInstances(
            client,
            ctx.assembly,
            insertGroups(set, parts)
        );
        const inserted = (response.insertInstanceResponses ?? []).map(
            (each) => each.occurrences?.[0]?.path ?? null
        );
        if (inserted.length !== parts.length || inserted.includes(null)) {
            // Which part Onshape answered no occurrence for, and how it answered
            console.error(
                "Quick fastener insert answered no path",
                parts.map((part) => part.name),
                JSON.stringify(response)
            );
        }
        return inserted;
    });
    ctx.result.inserted += paths.filter((path) => path !== null).length;
    return paths;
}

/** Fastens each inserted part where it sits. */
async function fastenParts(
    ctx: RunContext,
    set: FastenerSet,
    run: StepRunner,
    parts: PartPlacement[],
    paths: (string[] | null)[]
): Promise<void> {
    if (parts.some((part) => !set.studios[part.kind].mateConnectorId)) {
        throw runFailure(
            "A fastener's studio has no mate connector to fasten by. Reload its group."
        );
    }
    const washerEdges = await run("washer-edges", isTransient, (client) =>
        washerTopEdges(client, ctx.env.KV, set, parts)
    );
    const insertedPaths = paths.map((path) => path ?? undefined);
    for (const [index, part] of parts.entries()) {
        const path = insertedPaths[index];
        const connector = set.studios[part.kind].mateConnectorId;
        const mate =
            path && connector
                ? partMate(part, path, connector, insertedPaths, washerEdges)
                : undefined;
        if (!mate) {
            continue;
        }
        await run(`mate-${index}`, isRateLimited, async (client) => {
            await addAssemblyFeature(client, ctx.assembly, mate);
            return true;
        });
        ctx.result.fastened++;
    }
}

function skipRest(ctx: RunContext): void {
    for (const task of ctx.tasks) {
        if (task.state === FastenerTaskState.PENDING) {
            task.state = FastenerTaskState.SKIPPED;
        }
    }
}

/**
 * Runs one task: reports it started, then does its work. A failure is
 * recorded against the task in our own words; undefined when it failed.
 */
async function runTask<T>(
    ctx: RunContext,
    action: FastenerTaskAction,
    work: (run: StepRunner) => Promise<T>
): Promise<T | undefined> {
    const task = ctx.tasks.find((each) => each.action === action);
    if (!task) {
        return undefined;
    }
    task.state = FastenerTaskState.RUNNING;
    await ctx.step.do(`report-${action}`, () =>
        reportJob(ctx.env, ctx.assembly, ctx.status(FastenerJobState.RUNNING))
    );

    const run: StepRunner = (name, retryable, callback) =>
        ctx.step.do(name, { retries: ONSHAPE_STEP_RETRIES }, async () => {
            try {
                return await callback(
                    await getOnshapeApiFromSessionId(ctx.env.KV, ctx.sessionId)
                );
            } catch (error) {
                // Our own errors carry a status too, but say the same thing every time
                if (!(error instanceof ApiError) && retryable(error)) {
                    console.warn(
                        `Quick fastener step ${name} will retry`,
                        error
                    );
                    throw error;
                }
                // The job reports it in our words, so this is the only record of Onshape's
                console.error(`Quick fastener step ${name} failed`, error);
                throw new NonRetryableError(describeStepFailure(error, action));
            }
        });

    try {
        const value = await work(run);
        task.state = FastenerTaskState.DONE;
        return value;
    } catch (error) {
        task.state = FastenerTaskState.FAILED;
        task.reason = describeRunFailure(error);
        return undefined;
    }
}
