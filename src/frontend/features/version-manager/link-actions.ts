import {
    isSameWorkspace,
    LinkDirection,
    PullScopeKind,
    PushScopeKind,
    VersionJobKind,
    VersionJobState,
    type LinkedWorkspace,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import {
    openPullReferencesModal,
    openPushVersionModal
} from "./open-version-modals";
import { retireQuickActionTip } from "./version-manager-tips";
import {
    usePullReferencesMutation,
    usePushVersionMutation,
    useVersionJobQuery
} from "./queries";

/** The kind of run each direction's actions start. */
const DIRECTION_KIND = {
    [LinkDirection.PARENT]: VersionJobKind.PULL,
    [LinkDirection.CHILD]: VersionJobKind.PUSH
} as const;

/**
 * Everything a section and its rows can run, held once per direction so the
 * header outside the accordion panel and the rows inside it share a run.
 */
export interface LinkActions {
    /** The run going from this workspace, whichever direction it is. */
    running: VersionJobStatus | undefined;
    /** Whether that run is this direction's and aimed at exactly `linked`. */
    isRunningFor: (linked: LinkedWorkspace) => boolean;
    /** Whether it is this direction's and aimed at the whole section. */
    isRunningForAll: boolean;
    /** Opens one link's form. A whole direction has none: one name cannot
     * stand for the several versions it cuts. */
    openOne: (linked: LinkedWorkspace) => void;
    /** Runs it under the defaults the form would have shown. */
    quickAll: (recursive: boolean) => void;
    quickOne: (linked: LinkedWorkspace, recursive: boolean) => void;
    /** Moves one link's references onto versions that exist, cutting none. */
    updateOne: (linked: LinkedWorkspace) => void;
    /**
     * The same for every child; for parents, every out-of-date reference,
     * linked or not.
     */
    updateAll: () => void;
}

/** Updating all reaches every out-of-date reference, linked or not. */
function wholePullKind(
    recursive: boolean,
    updateOnly: boolean
): Exclude<PullScopeKind, PullScopeKind.ONE> {
    if (updateOnly) {
        return PullScopeKind.ALL;
    }
    return recursive ? PullScopeKind.ANCESTORS : PullScopeKind.PARENTS;
}

export function useLinkActions(
    workspace: WorkspacePath,
    direction: LinkDirection
): LinkActions {
    const pull = usePullReferencesMutation(workspace);
    const push = usePushVersionMutation(workspace);
    const { data: status } = useVersionJobQuery(workspace);
    const isChild = direction === LinkDirection.CHILD;

    const running =
        status?.state === VersionJobState.RUNNING ? status : undefined;
    const ownTargets =
        running?.kind === DIRECTION_KIND[direction]
            ? (running.targets ?? [])
            : undefined;

    /** A push for children, a pull for parents; `each` absent for the whole section. */
    const start = (
        each: LinkedWorkspace | undefined,
        { recursive = false, updateOnly = false } = {}
    ) => {
        if (isChild) {
            push.mutate({
                scope: each
                    ? {
                          kind: PushScopeKind.ONE,
                          workspace: each.workspace,
                          recursive
                      }
                    : {
                          kind: recursive
                              ? PushScopeKind.DESCENDANTS
                              : PushScopeKind.CHILDREN
                      },
                updateOnly
            });
            return;
        }
        pull.mutate({
            scope: each
                ? {
                      kind: PullScopeKind.ONE,
                      workspace: each.workspace,
                      recursive
                  }
                : { kind: wholePullKind(recursive, updateOnly) },
            updateOnly
        });
    };

    const quick = (each: LinkedWorkspace | undefined, recursive: boolean) => {
        // They have found the shortcut, so the form stops pointing at it.
        retireQuickActionTip();
        start(each, { recursive });
    };

    return {
        running,
        isRunningFor: (each) =>
            ownTargets?.length === 1 &&
            isSameWorkspace(ownTargets[0].workspace, each.workspace),
        isRunningForAll: ownTargets !== undefined && ownTargets.length !== 1,
        openOne: (each) =>
            isChild
                ? openPushVersionModal(workspace, each)
                : openPullReferencesModal(workspace, each),
        quickAll: (recursive) => quick(undefined, recursive),
        quickOne: (each, recursive) => quick(each, recursive),
        updateOne: (each) => start(each, { updateOnly: true }),
        updateAll: () => start(undefined, { updateOnly: true })
    };
}
