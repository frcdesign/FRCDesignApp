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
import { isTransient } from "../version-manager/failures";
import {
    FastenerJobState,
    FastenerTaskAction,
    FastenerTaskState,
    type FastenerJobResult,
    type FastenerJobStatus,
    type FastenerTask,
    type PlannedHole,
    type QuickFastenerIn
} from "./contract";
import {
    describeRunFailure,
    describeStepFailure,
    isRateLimited
} from "./failures";
import { gather } from "./gather";
import {
    insertGroups,
    mateConnectorIdsFor,
    partMate,
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
        const tasks: FastenerTask[] = Object.values(FastenerTaskAction).map(
            (action) => ({ action, state: FastenerTaskState.PENDING })
        );
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
    const plans = await runTask(ctx, FastenerTaskAction.INDEX, (run) =>
        run("index", isTransient, async (client) => {
            const gathered = await gather(
                client,
                ctx.env.KV,
                request.assembly,
                request.targets,
                request.excluded
            );
            return planHoles(
                gathered.circles,
                gathered.holes,
                gathered.placed,
                request.options
            );
        })
    );
    if (!plans) {
        skipRest(ctx);
        return;
    }
    ctx.holes = plans.map((plan) => plan.planned);

    const parts = placements(plans);
    if (parts.length === 0) {
        skipRest(ctx);
        return;
    }
    const paths = await runTask(ctx, FastenerTaskAction.INSERT, (run) =>
        run("insert", isRateLimited, async (client) => {
            const response = await insertTransformedInstances(
                client,
                request.assembly,
                insertGroups(parts)
            );
            return (response.insertInstanceResponses ?? []).map(
                (each) => each.occurrences?.[0]?.path ?? null
            );
        })
    );
    if (!paths) {
        skipRest(ctx);
        return;
    }
    ctx.result.inserted = paths.filter((path) => path !== null).length;

    await runTask(ctx, FastenerTaskAction.FASTEN, async (run) => {
        const kinds = [...new Set(parts.map((part) => part.kind))];
        const connectors = await run("mate-connectors", isTransient, (client) =>
            mateConnectorIdsFor(client, ctx.env.KV, request.assembly, kinds)
        );
        const washerEdges = await run("washer-edges", isTransient, (client) =>
            washerTopEdges(client, ctx.env.KV, parts)
        );
        const insertedPaths = paths.map((path) => path ?? undefined);
        for (const [index, part] of parts.entries()) {
            const path = insertedPaths[index];
            const connector = connectors[part.kind];
            const mate =
                path && connector
                    ? partMate(
                          part,
                          path,
                          connector,
                          insertedPaths,
                          washerEdges
                      )
                    : undefined;
            if (!mate) {
                continue;
            }
            await run(`mate-${index}`, isRateLimited, async (client) => {
                await addAssemblyFeature(client, request.assembly, mate);
                return true;
            });
            ctx.result.fastened++;
        }
    });
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
