import { describe, expect, it } from "vitest";
import {
    PullScopeKind,
    PushScopeKind,
    toWorkspacePath,
    VersionJobKind,
    VersionTaskAction,
    VersionTaskState,
    workspaceKey
} from "./contract";
import { planTasks } from "./tasks";
import type { PullJobParams, PushJobParams } from "./workflow";

const root = toWorkspacePath("robot", "robot-w");
const child = toWorkspacePath("practice", "practice-w");
const grandchild = toWorkspacePath("renders", "renders-w");

const base = {
    sessionId: "session",
    userId: "user",
    workspace: root,
    targets: [],
    documentNames: { [workspaceKey(child)]: "Practice Bot" },
    description: ""
};

function push(update: Partial<PushJobParams>): PushJobParams {
    return {
        ...base,
        kind: VersionJobKind.PUSH,
        scope: PushScopeKind.CHILDREN,
        updateOnly: false,
        steps: [],
        recursive: false,
        ...update
    };
}

function pull(update: Partial<PullJobParams>): PullJobParams {
    return {
        ...base,
        kind: VersionJobKind.PULL,
        scope: PullScopeKind.PARENTS,
        updateOnly: false,
        ...update
    };
}

const summary = (params: PushJobParams | PullJobParams) =>
    planTasks(params).map((task) => [task.action, task.workspace.documentId]);

describe("planTasks", () => {
    it("versions this document, then each child's references", () => {
        const tasks = planTasks(push({ steps: [child] }));
        expect(tasks.map((task) => [task.action, task.workspace])).toEqual([
            [VersionTaskAction.VERSION, root],
            [VersionTaskAction.REFERENCES, child]
        ]);
        expect(tasks[1].documentName).toBe("Practice Bot");
        expect(
            tasks.every((task) => task.state === VersionTaskState.PENDING)
        ).toBe(true);
    });

    it("versions each document a recursive push passes through", () => {
        expect(
            summary(push({ steps: [child, grandchild], recursive: true }))
        ).toEqual([
            [VersionTaskAction.VERSION, "robot"],
            [VersionTaskAction.REFERENCES, "practice"],
            [VersionTaskAction.VERSION, "practice"],
            [VersionTaskAction.REFERENCES, "renders"],
            [VersionTaskAction.VERSION, "renders"]
        ]);
    });

    it("cuts nothing for an update-only push", () => {
        expect(summary(push({ updateOnly: true, steps: [child] }))).toEqual([
            [VersionTaskAction.REFERENCES, "practice"]
        ]);
    });

    it("versions each parent a pull reads, unless it only updates", () => {
        expect(summary(pull({ sources: [child] }))).toEqual([
            [VersionTaskAction.VERSION, "practice"],
            [VersionTaskAction.REFERENCES, "robot"]
        ]);
        expect(summary(pull({ sources: [child], updateOnly: true }))).toEqual([
            [VersionTaskAction.REFERENCES, "robot"]
        ]);
        expect(summary(pull({ scope: PullScopeKind.ALL }))).toEqual([
            [VersionTaskAction.REFERENCES, "robot"]
        ]);
    });
});
