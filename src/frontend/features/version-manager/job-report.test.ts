import { describe, expect, it } from "vitest";
import {
    emptyJobResult,
    toWorkspacePath,
    VersionJobKind,
    VersionJobOutcome,
    VersionJobState,
    VersionTaskAction,
    VersionTaskState,
    type VersionJobResult,
    type VersionTask
} from "@backend/features/version-manager/contract";
import { jobHeadline, jobStats, runningHeadline } from "./job-report";

function result(update: Partial<VersionJobResult>): VersionJobResult {
    return { ...emptyJobResult(), ...update };
}

const practiceBot = {
    workspace: toWorkspacePath("practice", "practice-w"),
    documentName: "Practice Bot"
};

function task(state: VersionTaskState): VersionTask {
    return { ...practiceBot, action: VersionTaskAction.REFERENCES, state };
}

describe("jobHeadline", () => {
    it("names the run and how it went", () => {
        const status = {
            state: VersionJobState.COMPLETE,
            kind: VersionJobKind.PULL
        };
        expect(jobHeadline(status, VersionJobOutcome.SUCCESS)).toBe(
            "Pull succeeded"
        );
        expect(jobHeadline(status, VersionJobOutcome.PARTIAL)).toBe(
            "Pull partially failed"
        );
        expect(
            jobHeadline(
                { ...status, updateOnly: true },
                VersionJobOutcome.FAILED
            )
        ).toBe("Update failed");
    });
});

describe("runningHeadline", () => {
    it("names the one document a run is aimed at", () => {
        const running = {
            state: VersionJobState.RUNNING,
            targets: [practiceBot]
        };
        expect(runningHeadline({ ...running, kind: VersionJobKind.PUSH })).toBe(
            "Pushing to Practice Bot"
        );
        expect(runningHeadline({ ...running, kind: VersionJobKind.PULL })).toBe(
            "Pulling from Practice Bot"
        );
        expect(
            runningHeadline({
                ...running,
                kind: VersionJobKind.PUSH,
                updateOnly: true
            })
        ).toBe("Updating references in Practice Bot");
    });

    it("names a pull with no parents for what it does", () => {
        expect(
            runningHeadline({
                state: VersionJobState.RUNNING,
                kind: VersionJobKind.PULL,
                targets: []
            })
        ).toBe("Updating references");
        expect(
            runningHeadline({
                state: VersionJobState.RUNNING,
                kind: VersionJobKind.PULL,
                updateOnly: true,
                targets: [{ workspace: practiceBot.workspace }]
            })
        ).toBe("Updating references to Untitled document");
    });

    it("counts several", () => {
        expect(
            runningHeadline({
                state: VersionJobState.RUNNING,
                kind: VersionJobKind.PUSH,
                targets: [practiceBot, practiceBot]
            })
        ).toBe("Pushing to 2 documents");
    });
});

describe("jobStats", () => {
    it("counts what the run did, leaving out what it did none of", () => {
        expect(
            jobStats({
                state: VersionJobState.COMPLETE,
                tasks: [task(VersionTaskState.FAILED)],
                result: result({ createdVersions: 1, updatedElements: 5 })
            }).map((stat) => stat.label)
        ).toEqual(["1 version created", "5 tabs updated", "1 step failed"]);
        expect(
            jobStats({ state: VersionJobState.COMPLETE, result: result({}) })
        ).toEqual([]);
    });
});
