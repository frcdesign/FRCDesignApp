import { describe, expect, it } from "vitest";
import {
    emptyJobResult,
    toWorkspacePath,
    VersionJobKind,
    VersionJobState,
    VersionTaskAction,
    VersionTaskState,
    type VersionJobResult,
    type VersionTask
} from "@backend/features/version-manager/contract";
import {
    jobHeadline,
    JobOutcome,
    jobOutcome,
    jobStats,
    runningHeadline
} from "./job-report";

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

describe("jobOutcome", () => {
    it("has nothing to report while a run is going", () => {
        expect(jobOutcome({ state: VersionJobState.RUNNING })).toBeUndefined();
        expect(jobOutcome(undefined)).toBeUndefined();
    });

    it("calls a run with a failed step partial when it changed something", () => {
        const failedStep = [task(VersionTaskState.FAILED)];
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                tasks: failedStep,
                result: result({ createdVersions: 1 })
            })
        ).toBe(JobOutcome.PARTIAL);
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                tasks: failedStep,
                result: result({})
            })
        ).toBe(JobOutcome.FAILED);
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                tasks: [task(VersionTaskState.DONE)],
                result: result({})
            })
        ).toBe(JobOutcome.SUCCESS);
    });
});

describe("jobHeadline", () => {
    it("names the run and how it went", () => {
        const status = {
            state: VersionJobState.COMPLETE,
            kind: VersionJobKind.PULL
        };
        expect(jobHeadline(status, JobOutcome.SUCCESS)).toBe("Pull succeeded");
        expect(jobHeadline(status, JobOutcome.PARTIAL)).toBe(
            "Pull partially failed"
        );
        expect(
            jobHeadline({ ...status, updateOnly: true }, JobOutcome.FAILED)
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
