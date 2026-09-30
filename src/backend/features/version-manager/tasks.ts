/**
 * The steps a run will take, laid out before it takes any: what its status
 * lists while it goes, and what the workflow walks by index.
 */
import {
    VersionTaskAction,
    VersionTaskState,
    workspaceKey,
    type VersionTask,
    type WorkspacePath
} from "./contract";
import type { VersionJobParams } from "./workflow";

/**
 * In the order the workflow runs them, which `_push` and `_pull` in
 * `workflow.ts` must match index for index.
 */
export function planTasks(params: VersionJobParams): VersionTask[] {
    const task = (
        action: VersionTaskAction,
        workspace: WorkspacePath
    ): VersionTask => ({
        action,
        workspace,
        documentName: params.documentNames[workspaceKey(workspace)],
        state: VersionTaskState.PENDING
    });

    if (params.kind === "push") {
        if (params.updateOnly) {
            return params.steps.map((each) =>
                task(VersionTaskAction.REFERENCES, each.workspace)
            );
        }
        return [
            task(VersionTaskAction.VERSION, params.workspace),
            ...params.steps.flatMap((each) => [
                task(VersionTaskAction.REFERENCES, each.workspace),
                ...(each.createVersion
                    ? [task(VersionTaskAction.VERSION, each.workspace)]
                    : [])
            ])
        ];
    }

    const versions =
        params.sources && !params.updateOnly
            ? params.sources.map((source) =>
                  task(VersionTaskAction.VERSION, source)
              )
            : [];
    return [...versions, task(VersionTaskAction.REFERENCES, params.workspace)];
}
