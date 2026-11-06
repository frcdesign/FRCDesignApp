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
    deleteAssemblyFeature,
    deleteAssemblyInstances,
    getAssemblyFeatures,
    insertTransformedInstances
} from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import { ONSHAPE_STEP_RETRIES } from "../load/steps";
import { getDb } from "../../db/client";
import { isRateLimited, isTransient } from "../../lib/onshape/failures";
import {
    AssemblyJobState,
    AssemblyTaskAction,
    AssemblyTaskState,
    HoleStatus,
    type AssemblyJobResult,
    type AssemblyJobStatus,
    type AssemblyTask,
    type PlannedHole,
    pendingTasks,
    type AutoAssemblyIn
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
import { recordRunInserts } from "./track-inserts";
import { orphanedMates, type Replacement } from "./replace";
import { planHoles } from "./planner";

export interface AssemblyJobParams {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    /** Who started it, whom its inserts are recorded for. */
    userId: string;
    request: AutoAssemblyIn;
}

/** One run, shared by the steps that report on it. */
interface RunContext {
    env: AppBindings;
    step: WorkflowStep;
    sessionId: string;
    userId: string;
    assembly: ElementPath;
    tasks: AssemblyTask[];
    holes?: PlannedHole[];
    result: AssemblyJobResult;
    status: (state: AssemblyJobState) => AssemblyJobStatus;
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
export class AutoAssemblyWorkflow extends WorkflowEntrypoint<
    AppBindings,
    AssemblyJobParams
> {
    async run(
        event: WorkflowEvent<AssemblyJobParams>,
        step: WorkflowStep
    ): Promise<AssemblyJobResult> {
        const { sessionId, userId, request } = event.payload;
        const tasks: AssemblyTask[] = pendingTasks();
        const ctx: RunContext = {
            env: this.env,
            step,
            sessionId,
            userId,
            assembly: request.assembly,
            tasks,
            result: { inserted: 0, fastened: 0, replaced: 0 },
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
                    error ? AssemblyJobState.FAILED : AssemblyJobState.COMPLETE
                ),
                ...(error ? { error: describeRunFailure(error) } : {}),
                finishedAt: Date.now()
            })
        );
        return ctx.result;
    }
}

async function runSteps(ctx: RunContext, request: AutoAssemblyIn) {
    // As loaded when the run started, though the library reloads during it
    const set = await ctx.step.do(
        "fastener-set",
        async () => (await getFastenerSet(getDb(ctx.env.DB))) ?? null
    );
    if (!set) {
        throw runFailure("Auto Assembly's parts aren't published yet.");
    }
    const indexed = await runTask(ctx, AssemblyTaskAction.INDEX, (run) =>
        run("index", isTransient, async (client) => {
            const indexed = await indexHoles(
                client,
                ctx.env.KV,
                request.assembly,
                request.targets,
                request.excluded,
                set,
                request.replaced
            );
            return {
                plans: planHoles(
                    indexed.circularEdges,
                    indexed.holes,
                    indexed.placed,
                    request.options,
                    set.catalog
                ),
                unfound: indexed.unfound,
                replacements: indexed.replacements
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

    // A screw whose hole has no new plan keeps its parts
    const ready = new Set(
        plans
            .filter((plan) => plan.planned.status === HoleStatus.READY)
            .map((plan) => plan.planned.key)
    );
    const removing = indexed.replacements.filter((replacement) =>
        ready.has(replacement.key)
    );
    if (removing.length === 0) {
        skipTask(ctx, AssemblyTaskAction.REMOVE);
    } else if (
        !(await runTask(ctx, AssemblyTaskAction.REMOVE, (run) =>
            removeStacks(ctx, run, removing)
        ))
    ) {
        skipRest(ctx);
        return;
    }

    const paths = await runTask(ctx, AssemblyTaskAction.INSERT, (run) =>
        insertParts(ctx, set, run, parts)
    );
    if (!paths) {
        skipRest(ctx);
        return;
    }
    const mated = new Set<number>();
    await runTask(ctx, AssemblyTaskAction.FASTEN, (run) =>
        fastenParts(ctx, set, run, parts, paths, mated)
    );
    // Whatever fastening managed, what was inserted counts
    await ctx.step.do("record-inserts", () =>
        recordRunInserts(
            getDb(ctx.env.DB),
            ctx.userId,
            set,
            parts,
            paths,
            mated
        ).catch((error: unknown) =>
            console.error("Failed to record Auto Assembly's inserts", error)
        )
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
                "Auto Assembly insert answered no path",
                parts.map((part) => part.name),
                JSON.stringify(response)
            );
        }
        return inserted;
    });
    ctx.result.inserted += paths.filter((path) => path !== null).length;
    return paths;
}

/** Fastens each inserted part where it sits, adding each one mated to `mated`. */
async function fastenParts(
    ctx: RunContext,
    set: FastenerSet,
    run: StepRunner,
    parts: PartPlacement[],
    paths: (string[] | null)[],
    mated: Set<number>
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
        mated.add(index);
        ctx.result.fastened++;
    }
}

/**
 * Deletes each replaced screw with its washers and nuts in one change, then
 * any mate still referencing them. True once done.
 */
async function removeStacks(
    ctx: RunContext,
    run: StepRunner,
    replacements: Replacement[]
): Promise<boolean> {
    const instanceIds = [
        ...new Set(replacements.flatMap((each) => each.instanceIds))
    ];
    await run("remove-instances", isRateLimited, async (client) => {
        await deleteAssemblyInstances(
            client,
            ctx.assembly,
            instanceIds,
            "Auto Assembly: replace screws"
        );
        return true;
    });
    const mates = await run("orphaned-mates", isTransient, async (client) =>
        orphanedMates(
            (await getAssemblyFeatures(client, ctx.assembly)).features,
            instanceIds
        )
    );
    for (const [index, featureId] of mates.entries()) {
        await run(`remove-mate-${index}`, isRateLimited, async (client) => {
            await deleteAssemblyFeature(client, ctx.assembly, featureId);
            return true;
        });
    }
    ctx.result.replaced += replacements.length;
    return true;
}

function skipTask(ctx: RunContext, action: AssemblyTaskAction): void {
    const task = ctx.tasks.find((each) => each.action === action);
    if (task) {
        task.state = AssemblyTaskState.SKIPPED;
    }
}

function skipRest(ctx: RunContext): void {
    for (const task of ctx.tasks) {
        if (task.state === AssemblyTaskState.PENDING) {
            task.state = AssemblyTaskState.SKIPPED;
        }
    }
}

/**
 * Runs one task: reports it started, then does its work. A failure is
 * recorded against the task in our own words; undefined when it failed.
 */
async function runTask<T>(
    ctx: RunContext,
    action: AssemblyTaskAction,
    work: (run: StepRunner) => Promise<T>
): Promise<T | undefined> {
    const task = ctx.tasks.find((each) => each.action === action);
    if (!task) {
        return undefined;
    }
    task.state = AssemblyTaskState.RUNNING;
    await ctx.step.do(`report-${action}`, () =>
        reportJob(ctx.env, ctx.assembly, ctx.status(AssemblyJobState.RUNNING))
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
                        `Auto Assembly step ${name} will retry`,
                        error
                    );
                    throw error;
                }
                // The job reports it in our words, so this is the only record of Onshape's
                console.error(`Auto Assembly step ${name} failed`, error);
                throw new NonRetryableError(describeStepFailure(error, action));
            }
        });

    try {
        const value = await work(run);
        task.state = AssemblyTaskState.DONE;
        return value;
    } catch (error) {
        task.state = AssemblyTaskState.FAILED;
        task.reason = describeRunFailure(error);
        return undefined;
    }
}
