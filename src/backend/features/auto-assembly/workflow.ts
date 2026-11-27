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
import { isLongRateLimit } from "../../lib/workflow-steps";
import {
    AssemblyJobState,
    AssemblyRunKind,
    AssemblyTaskAction,
    AssemblyTaskState,
    HoleStatus,
    type AssemblyJobResult,
    type AssemblyJobStatus,
    type AssemblyTask,
    type DeclaredPart,
    type DeclaredPartsIn,
    DeclaredPartStatus,
    PickList,
    type PickProblem,
    type PlannedHole,
    type RunPart,
    type RunPick,
    type RunScrew,
    type SelectedEntity,
    pendingTasks,
    type AutoAssemblyIn
} from "./contract";
import {
    describeRunFailure,
    describeStepFailure,
    runFailure
} from "./failures";
import { getFastenerSet } from "./fastener-set";
import { FastenerKind, type FastenerSet } from "./studios";
import { indexHoles } from "./index-holes";
import {
    insertGroups,
    type PartPlacement,
    partMate,
    namePlacements,
    placements
} from "./insert";
import { reportJob } from "./jobs";
import { recordDeclaredInserts, recordRunInserts } from "./track-inserts";
import {
    declaredInsertGroups,
    declaredMate,
    declaredPart,
    type DeclaredPlan
} from "./declared";
import { indexDeclared } from "./index-declared";
import { orphanedMates, type Replacement } from "./replace";
import { planHoles } from "./planner";
import { pickProblems } from "./check";
import { pickKey } from "./picked";

export type AssemblyJobParams = {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    /** Who started it, whom its inserts are recorded for. */
    userId: string;
} & (
    | { kind?: AssemblyRunKind.FASTENERS; request: AutoAssemblyIn }
    | { kind: AssemblyRunKind.DECLARED_PARTS; request: DeclaredPartsIn }
);

/** One run, shared by the steps that report on it. */
interface RunContext {
    env: AppBindings;
    step: WorkflowStep;
    sessionId: string;
    userId: string;
    assembly: ElementPath;
    kind: AssemblyRunKind;
    tasks: AssemblyTask[];
    holes?: PlannedHole[];
    picks?: RunPick[];
    screws?: RunScrew[];
    declared?: DeclaredPart[];
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
    ): Promise<AssemblyJobStatus> {
        const { payload } = event;
        const { sessionId, userId, request } = payload;
        const kind = payload.kind ?? AssemblyRunKind.FASTENERS;
        const tasks: AssemblyTask[] = pendingTasks();
        const ctx: RunContext = {
            env: this.env,
            step,
            sessionId,
            userId,
            assembly: request.assembly,
            kind,
            tasks,
            result: { inserted: 0, fastened: 0, replaced: 0 },
            status: (state) => ({
                state,
                ...(kind === AssemblyRunKind.DECLARED_PARTS ? { kind } : {}),
                jobId: event.instanceId,
                tasks,
                ...(ctx.holes ? { holes: ctx.holes } : {}),
                ...(ctx.picks ? { picks: ctx.picks } : {}),
                ...(ctx.screws ? { screws: ctx.screws } : {}),
                ...(ctx.declared ? { declared: ctx.declared } : {}),
                result: ctx.result
            })
        };

        let error: unknown;
        try {
            if (payload.kind === AssemblyRunKind.DECLARED_PARTS) {
                await runDeclaredSteps(ctx, payload.request);
            } else {
                await runSteps(ctx, payload.request);
            }
        } catch (thrown) {
            error = thrown;
        }
        // Returned too: a read of KV can still see the run going after it has ended.
        const finished = await step.do(
            "finish-job",
            async (): Promise<AssemblyJobStatus> => {
                const status = {
                    ...ctx.status(
                        error
                            ? AssemblyJobState.FAILED
                            : AssemblyJobState.COMPLETE
                    ),
                    ...(error ? { error: describeRunFailure(error) } : {}),
                    finishedAt: Date.now()
                };
                await reportJob(this.env, request.assembly, status);
                return status;
            }
        );
        return finished;
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
                request.replaced,
                request.stopFace,
                {
                    flipped: request.flipped ?? [],
                    flipScrews: request.flipScrews ?? false
                }
            );
            const plans = planHoles(
                indexed.circularEdges,
                indexed.holes,
                indexed.placed,
                request.options,
                set.catalog,
                { stopPlane: indexed.stopPlane }
            );
            return {
                plans,
                unfound: indexed.unfound,
                replacements: indexed.replacements,
                picks: runPicks(
                    request,
                    pickProblems(
                        request,
                        indexed,
                        plans.map((plan) => plan.planned)
                    )
                )
            };
        })
    );
    if (!indexed) {
        skipRest(ctx);
        return;
    }
    const { plans } = indexed;
    ctx.holes = [...plans.map((plan) => plan.planned), ...indexed.unfound];
    ctx.picks = indexed.picks;
    warnTask(ctx, AssemblyTaskAction.INDEX, picksWarning(indexed.picks));

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

    const runParts = parts.map((part): RunPart => ({ role: part.role }));
    ctx.screws = runScrews(parts, runParts, removing);

    const paths = await runTask(ctx, AssemblyTaskAction.INSERT, (run) =>
        insertParts(ctx, set, run, parts)
    );
    if (!paths) {
        skipRest(ctx);
        return;
    }
    for (const [index, path] of paths.entries()) {
        if (path) {
            runParts[index].path = path;
        }
    }
    const mated = new Set<number>();
    await runTask(ctx, AssemblyTaskAction.FASTEN, (run) =>
        fastenParts(ctx, set, run, parts, paths, mated)
    );
    for (const index of mated) {
        runParts[index].isFastened = true;
    }
    const unmated = ctx.result.inserted - ctx.result.fastened;
    if (unmated > 0) {
        warnTask(
            ctx,
            AssemblyTaskAction.FASTEN,
            `${unmated} of ${ctx.result.inserted} parts weren't fastened, so they sit unmated.`
        );
    }
    // Whatever fastening managed, what was inserted counts
    await ctx.step.do("record-inserts", () =>
        recordRunInserts(ctx.env, ctx.userId, set, parts, paths, mated).catch(
            (error: unknown) =>
                console.error("Failed to record Auto Assembly's inserts", error)
        )
    );
}

/**
 * Places the parts FeatureScripts declared: finds every declaring connector,
 * inserts each part it names in one call, then fastens each on its connector.
 */
async function runDeclaredSteps(
    ctx: RunContext,
    request: DeclaredPartsIn
): Promise<void> {
    skipTask(ctx, AssemblyTaskAction.REMOVE);
    const plans = await runTask(ctx, AssemblyTaskAction.INDEX, (run) =>
        run("index", isTransient, (client) =>
            indexDeclared(client, ctx.env.KV, getDb(ctx.env.DB), ctx.assembly, {
                parts: request.parts,
                flipped: request.flipped
            })
        )
    );
    if (!plans) {
        skipRest(ctx);
        return;
    }
    const declared = plans.map(declaredPart);
    ctx.declared = declared;
    const unplaceable = plans.filter(
        (plan) => plan.status === DeclaredPartStatus.UNPLACEABLE
    ).length;
    if (unplaceable > 0) {
        warnTask(
            ctx,
            AssemblyTaskAction.INDEX,
            unplaceable === 1
                ? "1 part can't be placed."
                : `${unplaceable} parts can't be placed.`
        );
    }
    // Each ready plan with its entry in `declared`, in the order they're inserted
    const ready = plans.flatMap((plan, index) =>
        plan.status === DeclaredPartStatus.READY
            ? [{ plan, part: declared[index] }]
            : []
    );
    if (ready.length === 0) {
        skipRest(ctx);
        return;
    }

    const paths = await runTask(ctx, AssemblyTaskAction.INSERT, (run) =>
        run("insert", isRateLimited, async (client) => {
            const response = await insertTransformedInstances(
                client,
                ctx.assembly,
                declaredInsertGroups(plans)
            );
            return ready.map(
                (_, index) =>
                    response.insertInstanceResponses?.[index]?.occurrences?.[0]
                        ?.path ?? null
            );
        })
    );
    if (!paths) {
        skipRest(ctx);
        return;
    }
    ctx.result.inserted += paths.filter((path) => path !== null).length;
    for (const [index, path] of paths.entries()) {
        if (path) {
            ready[index].part.path = path;
        }
    }

    const mated = new Set<number>();
    await runTask(ctx, AssemblyTaskAction.FASTEN, async (run) => {
        for (const [index, { plan, part }] of ready.entries()) {
            const path = paths[index];
            if (!path) {
                continue;
            }
            await run(`mate-${index}`, isRateLimited, async (client) => {
                await addAssemblyFeature(
                    client,
                    ctx.assembly,
                    declaredMate(plan, path)
                );
                return true;
            });
            mated.add(index);
            part.isFastened = true;
            ctx.result.fastened++;
        }
    });
    const unmated = ctx.result.inserted - ctx.result.fastened;
    if (unmated > 0) {
        warnTask(
            ctx,
            AssemblyTaskAction.FASTEN,
            `${unmated} of ${ctx.result.inserted} parts weren't fastened, so they sit unmated.`
        );
    }
    await ctx.step.do("record-inserts", () =>
        recordDeclaredInserts(
            ctx.env,
            ctx.userId,
            ready.map(({ plan }): DeclaredPlan => plan),
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
    const washerTop = set.studios[FastenerKind.WASHER].topMateConnectorId;
    const isOnWasher = parts.some((part) => "washer" in part.seat);
    if (
        parts.some((part) => !set.studios[part.kind].mateConnectorId) ||
        (isOnWasher && !washerTop)
    ) {
        throw runFailure(
            "A fastener's studio has no mate connector to fasten by. Reload its group."
        );
    }
    const insertedPaths = paths.map((path) => path ?? undefined);
    for (const [index, part] of parts.entries()) {
        const path = insertedPaths[index];
        const connector = set.studios[part.kind].mateConnectorId;
        const mate =
            path && connector
                ? partMate(
                      part,
                      path,
                      connector,
                      insertedPaths,
                      washerTop ?? ""
                  )
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
            "Auto Assembly: update screws"
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
                if (
                    !(error instanceof ApiError) &&
                    retryable(error) &&
                    !isLongRateLimit(error)
                ) {
                    console.warn(
                        `Auto Assembly step ${name} will retry`,
                        error
                    );
                    throw error;
                }
                // The job reports it in our words, so this is the only record of Onshape's
                console.error(`Auto Assembly step ${name} failed`, error);
                throw new NonRetryableError(
                    describeStepFailure(error, action, ctx.kind)
                );
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

/** The parts grouped by the screw they go with, sharing each `RunPart` so the run can mark it as it goes. */
function runScrews(
    parts: PartPlacement[],
    runParts: RunPart[],
    removing: Replacement[]
): RunScrew[] {
    const updated = new Set(removing.map((replacement) => replacement.key));
    const screws = new Map<string, RunScrew>();
    for (const [index, part] of parts.entries()) {
        const screw = screws.get(part.hole) ?? {
            hole: part.hole,
            isUpdate: updated.has(part.hole),
            parts: []
        };
        screw.parts.push(runParts[index]);
        screws.set(part.hole, screw);
    }
    return [...screws.values()];
}

/** Each pick of a run, in the form's order, with its problem. */
function runPicks(request: AutoAssemblyIn, problems: PickProblem[]): RunPick[] {
    const byKey = new Map(
        problems.map(({ key, ...problem }) => [key, problem])
    );
    const lists: [PickList, SelectedEntity[]][] = [
        [PickList.TARGETS, request.targets],
        [PickList.EXCLUDED, request.excluded],
        [PickList.REPLACED, request.replaced],
        [PickList.STOP_FACE, request.stopFace ? [request.stopFace] : []]
    ];
    return lists.flatMap(([list, entities]) =>
        entities.map((entity) => {
            const problem = byKey.get(pickKey(entity));
            return { list, entity, ...(problem ? { problem } : {}) };
        })
    );
}

/** "2 picks have problems", or nothing when none do. */
function picksWarning(picks: RunPick[]): string | undefined {
    const count = picks.filter((pick) => pick.problem).length;
    if (count === 0) {
        return undefined;
    }
    return count === 1
        ? "1 pick has a problem."
        : `${count} picks have problems.`;
}

/** Marks a finished task with what it left undone. */
function warnTask(
    ctx: RunContext,
    action: AssemblyTaskAction,
    warning: string | undefined
): void {
    const task = ctx.tasks.find((each) => each.action === action);
    if (task?.state === AssemblyTaskState.DONE && warning) {
        task.warning = warning;
    }
}
