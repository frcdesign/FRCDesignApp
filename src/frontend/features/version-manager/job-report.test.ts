import { describe, expect, it } from "vitest";
import {
    toWorkspacePath,
    VersionJobKind,
    VersionJobOutcome,
    VersionJobState
} from "@backend/features/version-manager/contract";
import { jobHeadline, runningHeadline } from "./job-report";

const practiceBot = {
    workspace: toWorkspacePath("practice", "practice-w"),
    documentName: "Practice Bot"
};

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
