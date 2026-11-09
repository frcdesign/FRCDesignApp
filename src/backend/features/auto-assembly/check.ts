/** Why each pick won't do what it was picked for, from a run's own indexing and plans. Pure. */
import {
    HoleStatus,
    type PickCheckIn,
    type PickProblem,
    type PlannedHole,
    ProblemSeverity
} from "./contract";
import { type IndexedHoles } from "./index-holes";
import { pickKey } from "./picked";

const ALREADY_FASTENED =
    "A library screw is already in this hole. Pick it under Screws to replace to change it.";

type Problem = Omit<PickProblem, "key">;

const error = (message: string): Problem => ({
    message,
    severity: ProblemSeverity.ERROR
});

/** What's wrong with a hole's plan, if anything: an error where it won't be fastened, a warning where it will be, poorly. */
function holeProblem(planned: PlannedHole | undefined): Problem | undefined {
    if (!planned) {
        return undefined;
    }
    switch (planned.status) {
        case HoleStatus.READY:
            return planned.warning
                ? {
                      message: planned.warning,
                      severity: ProblemSeverity.WARNING
                  }
                : undefined;
        case HoleStatus.FASTENED:
            return error(ALREADY_FASTENED);
        case HoleStatus.NO_FIT:
            return error(planned.reason ?? "This hole can't be fastened.");
    }
}

/** Every hole a pick gave must plan ready, without a warning; a face says how many of its holes don't, errors first. */
function plannedProblem(
    edges: string[],
    plans: Map<string, PlannedHole> | undefined
): Problem | undefined {
    if (!plans) {
        return undefined;
    }
    const problems = edges.flatMap((edge) => {
        const problem = holeProblem(plans.get(edge));
        return problem ? [problem] : [];
    });
    const errors = problems.filter(
        (problem) => problem.severity === ProblemSeverity.ERROR
    );
    const worst = errors.length > 0 ? errors : problems;
    if (worst.length === 0) {
        return undefined;
    }
    if (edges.length === 1) {
        return worst[0];
    }
    const counted =
        worst === errors
            ? `${worst.length} of ${edges.length} holes can't be fastened`
            : `${worst.length} of ${edges.length} holes have a warning`;
    return { ...worst[0], message: `${counted}: ${worst[0].message}` };
}

/** Plans are left out when there are no options to plan with. */
export function pickProblems(
    request: Pick<PickCheckIn, "targets" | "excluded" | "replaced">,
    indexed: IndexedHoles,
    planned?: PlannedHole[]
): PickProblem[] {
    const unfound = new Map(
        indexed.unfound.map((hole) => [hole.key, hole.reason])
    );
    const plans = planned && new Map(planned.map((hole) => [hole.key, hole]));
    const targetEdges = new Set(
        request.targets.flatMap(
            (pick) => indexed.pickEdges[pickKey(pick)] ?? []
        )
    );
    const problem = (key: string, found: Problem | undefined) =>
        found ? [{ key, ...found }] : [];
    const unfoundProblem = (key: string) => {
        const reason = unfound.get(key);
        return reason === undefined ? undefined : error(reason);
    };

    return [
        ...request.targets.flatMap((pick) => {
            const key = pickKey(pick);
            return problem(
                key,
                unfoundProblem(key) ??
                    plannedProblem(indexed.pickEdges[key] ?? [], plans)
            );
        }),
        ...request.excluded.flatMap((pick) => {
            const key = pickKey(pick);
            const edges = indexed.pickEdges[key] ?? [];
            return problem(
                key,
                edges.some((edge) => targetEdges.has(edge))
                    ? undefined
                    : error("Not a hole in the faces picked.")
            );
        }),
        ...request.replaced.flatMap((pick) => {
            const key = pickKey(pick);
            const planned = plannedProblem(indexed.pickEdges[key] ?? [], plans);
            return problem(
                key,
                unfoundProblem(key) ??
                    (planned?.severity === ProblemSeverity.ERROR
                        ? error(
                              `Its hole can't be fastened again, so it stays: ${planned.message}`
                          )
                        : planned)
            );
        })
    ];
}
