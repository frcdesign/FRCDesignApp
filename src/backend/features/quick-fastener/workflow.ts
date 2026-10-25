import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
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
    mateConnectorIdsFor,
    type PartPlacement,
    PartStack,
    partMate,
    placements,
    replicateGroups,
    stackTargets,
    washerTopEdges
} from "./insert";
import { reportJob } from "./jobs";
import { planHoles } from "./planner";
import { addReplicate } from "./replicate";

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
            result: { inserted: 0, fastened: 0, replicated: 0 },
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
    const plans = await runTask(ctx, FastenerTaskAction.INDEX, (run) =>
        run("index", isTransient, async (client) => {
            const indexed = await indexHoles(
                client,
                ctx.env.KV,
                request.assembly,
                request.targets,
                request.excluded,
                set
            );
            return planHoles(
                indexed.circularEdges,
                indexed.holes,
                indexed.placed,
                request.options,
                set.catalog
            );
        })
    );
    if (!plans) {
        skipRest(ctx);
        return;
    }
    ctx.holes = plans.map((plan) => plan.planned);

    // Only each group's first hole gets parts; a Replicate puts them on the rest
    const groups = replicateGroups(plans);
    const later = new Set(
        groups.flatMap((group) =>
            group.slice(1).map((plan) => plan.planned.key)
        )
    );
    const parts = placements(
        set,
        plans.filter((plan) => !later.has(plan.planned.key))
    );
    if (parts.length === 0) {
        skipRest(ctx);
        return;
    }
    const paths = await runTask(ctx, FastenerTaskAction.INSERT, (run) =>
        insertParts(ctx, set, run, "", parts)
    );
    if (!paths) {
        skipRest(ctx);
        return;
    }

    const mates = await runTask(ctx, FastenerTaskAction.FASTEN, (run) =>
        fastenParts(ctx, set, run, "", parts, paths)
    );
    if (!mates) {
        skipRest(ctx);
        return;
    }

    if (groups.every((group) => group.length < 2)) {
        skipRest(ctx);
        return;
    }
    await runTask(ctx, FastenerTaskAction.REPLICATE, async (run) => {
        for (const [index, group] of groups.entries()) {
            const [seed, ...rest] = group;
            if (rest.length === 0) {
                continue;
            }
            for (const stack of Object.values(PartStack)) {
                const seedParts = [...parts.entries()].filter(
                    ([, part]) =>
                        part.hole === seed.planned.key && part.stack === stack
                );
                if (seedParts.length === 0) {
                    continue;
                }
                // The mate holding the stack on its edge, which each copy is placed as
                const seated = seedParts.find(
                    ([, part]) => "edge" in part.seat
                );
                const mateFeatureId = seated ? mates[seated[0]] : null;
                const instancePaths = seedParts.map(([each]) => paths[each]);
                if (
                    !mateFeatureId ||
                    !instancePaths.every(
                        (path): path is string[] => path !== null
                    )
                ) {
                    throw runFailure(
                        "A hole's parts weren't all inserted and fastened, so they can't be replicated."
                    );
                }
                await run(
                    `replicate-${index}-${stack}`,
                    isRateLimited,
                    async (client) => {
                        await addReplicate(client, request.assembly, {
                            name: "Quick fastener replicate",
                            instancePaths,
                            mateFeatureId,
                            edges: stackTargets(group, stack)
                        });
                        return true;
                    }
                );
            }
            ctx.result.replicated += rest.length;
        }
    });
}

/** Inserts parts in one call: each one's occurrence path, or null where Onshape answered none. */
async function insertParts(
    ctx: RunContext,
    set: FastenerSet,
    run: StepRunner,
    prefix: string,
    parts: PartPlacement[]
): Promise<(string[] | null)[]> {
    const paths = await run(
        `${prefix}insert`,
        isRateLimited,
        async (client) => {
            const response = await insertTransformedInstances(
                client,
                ctx.assembly,
                insertGroups(set, parts)
            );
            return (response.insertInstanceResponses ?? []).map(
                (each) => each.occurrences?.[0]?.path ?? null
            );
        }
    );
    ctx.result.inserted += paths.filter((path) => path !== null).length;
    return paths;
}

/** Fastens each inserted part where it sits: each one's mate feature id, or null where it has none. */
async function fastenParts(
    ctx: RunContext,
    set: FastenerSet,
    run: StepRunner,
    prefix: string,
    parts: PartPlacement[],
    paths: (string[] | null)[]
): Promise<(string | null)[]> {
    const kinds = [...new Set(parts.map((part) => part.kind))];
    const connectors = await run(
        `${prefix}mate-connectors`,
        isTransient,
        (client) =>
            mateConnectorIdsFor(client, ctx.env.KV, ctx.assembly, set, kinds)
    );
    const washerEdges = await run(
        `${prefix}washer-edges`,
        isTransient,
        (client) => washerTopEdges(client, ctx.env.KV, set, parts)
    );
    const insertedPaths = paths.map((path) => path ?? undefined);
    const mates: (string | null)[] = [];
    for (const [index, part] of parts.entries()) {
        const path = insertedPaths[index];
        const connector = connectors[part.kind];
        const mate =
            path && connector
                ? partMate(part, path, connector, insertedPaths, washerEdges)
                : undefined;
        if (!mate) {
            mates.push(null);
            continue;
        }
        mates.push(
            await run(
                `${prefix}mate-${index}`,
                isRateLimited,
                async (client) => {
                    const added = await addAssemblyFeature(
                        client,
                        ctx.assembly,
                        mate
                    );
                    return added.feature.featureId;
                }
            )
        );
        ctx.result.fastened++;
    }
    return mates;
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
                if (retryable(error)) {
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
