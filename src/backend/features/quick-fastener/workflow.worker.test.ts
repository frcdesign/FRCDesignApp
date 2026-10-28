import { env } from "cloudflare:workers";
import { introspectWorkflowInstance } from "cloudflare:test";
import * as FastenerSets from "./fastener-set";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ASSEMBLY,
    BODY,
    DEFINITION,
    fs,
    plateScan
} from "../../../__test_utils__/quick-fastener-fixtures";
import * as RequestAuth from "../auth/request-auth";
import * as Assemblies from "../../lib/onshape/endpoints/assemblies";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as PartStudios from "../../lib/onshape/endpoints/part-studios";
import { OnshapeApiError, type OAuthApi } from "../../lib/onshape/client";
import * as Planner from "./planner";
import { FastenerKind } from "./studios";

const WASHER = { vendor: "GENERIC", size: "NO_10_32", type: "OD_1_2_X_0_049" };
import {
    FastenerJobOutcome,
    fastenerJobOutcome,
    FastenerJobState,
    FastenerTaskState,
    HoleEnd,
    HoleStatus,
    SelectedEntityType,
    type FastenerJobStatus
} from "./contract";
import { getJobStatus } from "./jobs";
import { resetStorage } from "../../../__test_utils__/storage";
import type { FastenerJobParams } from "./workflow";
import { getDb } from "../../db/client";
import { events, dailyMetrics } from "../analytics/schema";
import { InsertSource } from "../analytics/usage";
import { seedGroup, seedInsertable } from "../../../__test_utils__/seed";

/** Runs the workflow to its end and answers what it stored. */
async function run(
    id: string,
    params: FastenerJobParams
): Promise<FastenerJobStatus> {
    await using instance = await introspectWorkflowInstance(
        env.QUICK_FASTENER_WORKFLOW,
        id
    );
    await instance.modify(async (m) => {
        await m.disableRetryDelays();
    });
    await env.QUICK_FASTENER_WORKFLOW.create({ id, params });
    await instance.waitForStatus("complete");
    return getJobStatus(env, ASSEMBLY);
}

/** A washer: its hole from z = 0 up to its thickness. */
const WASHER_SCAN = fs.map({
    parts: fs.map({
        W: fs.map({
            holes: fs.array([
                fs.map({
                    faceId: fs.string("WF"),
                    origin: fs.vector([0, 0, 0]),
                    direction: fs.vector([0, 0, 1]),
                    radius: fs.number(0.003),
                    start: fs.number(0),
                    end: fs.number(0.001),
                    closedAtStart: fs.boolean(false),
                    closedAtEnd: fs.boolean(false),
                    threaded: fs.boolean(false),
                    edges: fs.array([
                        fs.map({ id: fs.string("W-bottom"), at: fs.number(0) }),
                        fs.map({ id: fs.string("W-top"), at: fs.number(0.001) })
                    ])
                })
            ])
        })
    }),
    circles: fs.array([])
});

let mates: string[];

beforeEach(async () => {
    for (const key of (await env.KV.list({ prefix: "" })).keys) {
        if (
            key.name.startsWith("quick-fastener") ||
            key.name.startsWith("fastener-job")
        ) {
            await env.KV.delete(key.name);
        }
    }
    vi.spyOn(FastenerSets, "getFastenerSet").mockResolvedValue(FASTENER_SET);
    mates = [];
    vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockResolvedValue(
        {} as OAuthApi
    );
    vi.spyOn(Documents, "getElements").mockResolvedValue([
        {
            id: "topStudio",
            name: "Top",
            elementType: "PARTSTUDIO",
            microversionId: "t1"
        },
        {
            id: "bottomStudio",
            name: "Bottom",
            elementType: "PARTSTUDIO",
            microversionId: "b1"
        }
    ] as Awaited<ReturnType<typeof Documents.getElements>>);
    vi.spyOn(PartStudios, "evaluateFeatureScript").mockImplementation(
        (_client, path, script) =>
            Promise.resolve({
                result:
                    path.elementId === "washerStudio"
                        ? WASHER_SCAN
                        : path.elementId === "topStudio"
                          ? plateScan(
                                "TOP",
                                script.includes('qTransient("TOP-top")')
                                    ? ["TOP-top"]
                                    : []
                            )
                          : plateScan("BOTTOM")
            })
    );
    // The assembly as read to index it, then with the parts inserted
    vi.spyOn(Assemblies, "getAssembly").mockImplementation(
        (_client, _path, options) =>
            Promise.resolve(
                options?.includeMateConnectors
                    ? {
                          ...DEFINITION,
                          parts: Object.values(FastenerKind).map((kind) => ({
                              documentId: "lib",
                              elementId: `${kind}Studio`,
                              documentVersion: "libv",
                              mateConnectors: [{ featureId: `${kind}MC` }]
                          }))
                      }
                    : DEFINITION
            )
    );
    vi.spyOn(Assemblies, "insertTransformedInstances").mockImplementation(
        (_client, _path, groups) =>
            Promise.resolve({
                insertInstanceResponses: groups.map((_, index) => ({
                    occurrences: [{ path: [`part${index}`] }]
                }))
            })
    );
    vi.spyOn(Assemblies, "addAssemblyFeature").mockImplementation(
        (_client, _path, feature) => {
            mates.push(JSON.stringify(feature));
            return Promise.resolve({ feature: { featureId: "mate" } });
        }
    );
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("QuickFastenerWorkflow", () => {
    it("indexes, inserts, and fastens each part on the one under it", async () => {
        const status = await run("full", {
            sessionId: "session",
            userId: "user",
            request: {
                ...BODY,
                options: {
                    ...BODY.options,
                    screwWasher: WASHER,
                    nutWasher: WASHER
                }
            }
        });

        expect(status.state).toBe(FastenerJobState.COMPLETE);
        expect(status.tasks?.map((task) => task.state)).toEqual([
            FastenerTaskState.DONE,
            FastenerTaskState.DONE,
            FastenerTaskState.DONE
        ]);
        expect(status.holes?.[0]).toMatchObject({
            status: HoleStatus.READY,
            screw: { length: "IN_1" }
        });
        // Washer, screw, washer, nut
        expect(status.result).toEqual({ inserted: 4, fastened: 4 });
        expect(fastenerJobOutcome(status)).toBe(FastenerJobOutcome.SUCCESS);

        expect(mates[0]).toContain('"deterministicIds":["TOP-top"]');
        // The screw on the first washer's top edge
        expect(mates[1]).toContain('"featureId":"screwMC"');
        expect(mates[1]).toContain(
            '"deterministicIds":["W-top"],"path":["part0"]'
        );
        expect(mates[2]).toContain('"deterministicIds":["BOTTOM-bottom"]');
        expect(mates[3]).toContain(
            '"deterministicIds":["W-top"],"path":["part2"]'
        );
    });

    it("records each part it inserted as a fastened Quick fastener insert", async () => {
        const db = getDb(env.DB);
        await seedGroup(db);
        for (const kind of Object.values(FastenerKind)) {
            await seedInsertable(db, {
                id: `${kind}-row`,
                elementId: `${kind}Studio`
            });
        }
        await run("recorded", {
            sessionId: "session",
            userId: "user",
            request: {
                ...BODY,
                options: { ...BODY.options, screwWasher: WASHER }
            }
        });

        const recorded = await db.select().from(events).all();
        // Washer, screw, nut
        expect(
            recorded.map((event) => [
                event.elementId,
                event.source,
                event.fasten,
                event.fastenable,
                event.userId
            ])
        ).toEqual(
            ["washerStudio", "screwStudio", "nutStudio"].map((elementId) => [
                elementId,
                InsertSource.QUICK_FASTENER,
                true,
                true,
                "user"
            ])
        );
        const [day] = await db.select().from(dailyMetrics).all();
        expect(day).toMatchObject({
            count: 3,
            fastenableCount: 3,
            quickFastenerCount: 3,
            preselectedCount: 0
        });
    });

    it("says why a pick gave no circular edge", async () => {
        const status = await run("unfound", {
            sessionId: "session",
            userId: "user",
            request: {
                ...BODY,
                targets: [
                    ...BODY.targets,
                    {
                        occurrencePath: ["gone"],
                        entityId: "X",
                        entityType: SelectedEntityType.EDGE
                    },
                    {
                        occurrencePath: ["top"],
                        entityId: "TOP-face",
                        entityType: SelectedEntityType.EDGE
                    }
                ]
            }
        });

        expect(status.holes).toEqual([
            expect.objectContaining({ status: HoleStatus.READY }),
            {
                key: "gone|X",
                status: HoleStatus.NO_FIT,
                reason: "Couldn't find this part in the assembly."
            },
            {
                key: "top|TOP-face",
                status: HoleStatus.NO_FIT,
                reason: "Not a circular edge."
            }
        ]);
    });

    describe("alike holes", () => {
        const INCH = 0.0254;
        /** Two alike holes through the top plate, `a` and `b`. */
        const alike = (key: string): Planner.HolePlan => ({
            circularEdge: {
                key,
                occurrencePath: ["top"],
                edgeId: key,
                center: [0, 0, 0],
                normal: [0, 0, 1],
                radius: (0.201 * INCH) / 2
            },
            planned: {
                key,
                status: HoleStatus.READY,
                end: HoleEnd.THROUGH,
                depth: 0.5 * INCH,
                screw: {
                    vendor: "GENERIC",
                    size: "NO_10_32",
                    head: "BUTTON",
                    finish: "BLACK",
                    length: "IN_1",
                    fullyThreaded: "false"
                },
                nut: { vendor: "MCMASTER", size: "NO_10_32", type: "NYLOCK" }
            },
            exit: {
                point: [0, 0, -0.5 * INCH],
                edge: { occurrencePath: ["bottom"], edgeId: `${key}-far` },
                radius: (0.201 * INCH) / 2
            }
        });
        beforeEach(() => {
            vi.spyOn(Planner, "planHoles").mockReturnValue([
                alike("a"),
                alike("b")
            ]);
        });

        it("inserts and fastens every hole's own parts", async () => {
            const status = await run("alike", {
                sessionId: "session",
                userId: "user",
                request: BODY
            });

            expect(status.tasks?.map((task) => task.action)).toEqual([
                "index",
                "insert",
                "fasten"
            ]);
            // A screw and a nut in each
            expect(status.result).toEqual({ inserted: 4, fastened: 4 });
            ["a", "a-far", "b", "b-far"].forEach((edge, index) =>
                expect(mates[index]).toContain(`"deterministicIds":["${edge}"]`)
            );
            expect(fastenerJobOutcome(status)).toBe(FastenerJobOutcome.SUCCESS);
        });
    });

    it("fails fastening when a studio's load found no mate connector", async () => {
        vi.mocked(FastenerSets.getFastenerSet).mockResolvedValue({
            ...FASTENER_SET,
            studios: {
                ...FASTENER_SET.studios,
                [FastenerKind.SCREW]: {
                    ...FASTENER_SET.studios[FastenerKind.SCREW],
                    mateConnectorId: undefined
                }
            }
        });
        const status = await run("no-connector", {
            sessionId: "session",
            userId: "user",
            request: BODY
        });

        expect(status.tasks?.[2]).toMatchObject({
            state: FastenerTaskState.FAILED,
            reason: "A fastener's studio has no mate connector to fasten by. Reload its group."
        });
        expect(Assemblies.addAssemblyFeature).not.toHaveBeenCalled();
    });

    it("fails a step at once on the app's own error, whatever its status", async () => {
        // Nothing cached from another test's run
        await resetStorage();
        // The hole scan failing is our own 502, which a retry would only repeat
        vi.mocked(PartStudios.evaluateFeatureScript).mockResolvedValue({
            notices: [{ message: { message: "bad lambda" } }]
        });
        const status = await run("own-error", {
            sessionId: "session",
            userId: "user",
            request: BODY
        });

        // In our words: the notices are for the logs
        expect(status.tasks?.[0]).toMatchObject({
            state: FastenerTaskState.FAILED,
            reason: "Couldn't read the assembly's holes."
        });
        const scanned = vi
            .mocked(PartStudios.evaluateFeatureScript)
            .mock.calls.map(([, path]) => path.elementId);
        expect(scanned).toEqual([...new Set(scanned)]);
    });

    it("stops before inserting when Onshape refuses to read the assembly", async () => {
        vi.mocked(Assemblies.getAssembly).mockRejectedValue(
            new OnshapeApiError("Onshape API error 403: Forbidden", 403)
        );
        const status = await run("forbidden", {
            sessionId: "session",
            userId: "user",
            request: BODY
        });
        expect(status.tasks?.map((task) => task.state)).toEqual([
            FastenerTaskState.FAILED,
            FastenerTaskState.SKIPPED,
            FastenerTaskState.SKIPPED
        ]);
        expect(status.tasks?.[0].reason).toBe(
            "You don't have permission to edit this assembly."
        );
        expect(Assemblies.insertTransformedInstances).not.toHaveBeenCalled();
        expect(fastenerJobOutcome(status)).toBe(FastenerJobOutcome.FAILED);
    });
});
