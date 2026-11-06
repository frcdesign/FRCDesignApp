/** Why each pick won't do what it was picked for, from a run's own indexing and plans. Pure. */
import {
    HoleStatus,
    type PickCheckIn,
    type PickProblem,
    type PlannedHole
} from "./contract";
import { type IndexedHoles } from "./index-holes";
import { pickKey } from "./picked";

const ALREADY_FASTENED =
    "A library screw is already in this hole. Pick it under Screws to replace to change it.";

/** What's wrong with a hole's plan, if anything. */
function holeProblem(planned: PlannedHole | undefined): string | undefined {
    if (!planned || planned.status === HoleStatus.READY) {
        return undefined;
    }
    return planned.status === HoleStatus.FASTENED
        ? ALREADY_FASTENED
        : (planned.reason ?? "This hole can't be fastened.");
}

/** Every hole a pick gave must plan ready; a face says how many of its holes don't. */
function plannedProblem(
    edges: string[],
    plans: Map<string, PlannedHole> | undefined
): string | undefined {
    if (!plans) {
        return undefined;
    }
    const problems = edges.flatMap((edge) => {
        const problem = holeProblem(plans.get(edge));
        return problem ? [problem] : [];
    });
    if (problems.length === 0) {
        return undefined;
    }
    return edges.length === 1
        ? problems[0]
        : `${problems.length} of ${edges.length} holes can't be fastened: ${problems[0]}`;
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
    const problem = (key: string, message: string | undefined) =>
        message ? [{ key, message }] : [];

    return [
        ...request.targets.flatMap((pick) => {
            const key = pickKey(pick);
            return problem(
                key,
                unfound.get(key) ??
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
                    : "Not a hole in the faces picked."
            );
        }),
        ...request.replaced.flatMap((pick) => {
            const key = pickKey(pick);
            const reason = plannedProblem(indexed.pickEdges[key] ?? [], plans);
            return problem(
                key,
                unfound.get(key) ??
                    (reason &&
                        `Its hole can't be fastened again, so it stays: ${reason}`)
            );
        })
    ];
}
