/** The tasks a run will take, laid out before it takes any. */
import {
    isSameWorkspace,
    VersionJobKind,
    VersionTaskAction,
    VersionTaskState,
    workspaceKey,
    type VersionTask,
    type WorkspacePath
} from "./contract";
import type { VersionJobParams } from "./workflow";

/** In the order the workflow runs them. */
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
    const { REFERENCES, VERSION } = VersionTaskAction;

    if (params.kind === VersionJobKind.PUSH) {
        if (params.updateOnly) {
            return params.steps.map((each) => task(REFERENCES, each));
        }
        return [
            task(VERSION, params.workspace),
            ...params.steps.flatMap((each) => [
                task(REFERENCES, each),
                ...(params.recursive ? [task(VERSION, each)] : [])
            ])
        ];
    }

    const referencing = params.referencing ?? [];
    const versions =
        params.sources && !params.updateOnly
            ? params.sources.flatMap((source) => [
                  ...(referencing.some((each) => isSameWorkspace(each, source))
                      ? [task(REFERENCES, source)]
                      : []),
                  task(VERSION, source)
              ])
            : [];
    return [...versions, task(REFERENCES, params.workspace)];
}
