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
} from "../../../__test_utils__/auto-assembly-fixtures";
import * as RequestAuth from "../auth/request-auth";
import * as Assemblies from "../../lib/onshape/endpoints/assemblies";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as PartStudios from "../../lib/onshape/endpoints/part-studios";
import { OnshapeApiError, type OAuthApi } from "../../lib/onshape/client";
import * as Planner from "./planner";
import * as IndexHoles from "./index-holes";
import { FastenerKind } from "./studios";

const WASHER = { vendor: "GENERIC", size: "NO_10_32", type: "OD_1_2_X_0_049" };
import {
    AssemblyJobOutcome,
    assemblyJobOutcome,
    AssemblyJobState,
    AssemblyTaskState,
    HoleEnd,
    HoleStatus,
    SelectedEntityType,
    type AssemblyJobStatus
} from "./contract";
import { getJobStatus } from "./jobs";
import { resetStorage } from "../../../__test_utils__/storage";
import type { AssemblyJobParams } from "./workflow";
import { getDb } from "../../db/client";
import { events, dailyMetrics } from "../analytics/schema";
import { InsertSource } from "../analytics/usage";
import { seedGroup, seedInsertable } from "../../../__test_utils__/seed";

/** Runs the workflow to its end and answers what it stored. */
async function run(
    id: string,
    params: AssemblyJobParams
): Promise<AssemblyJobStatus> {
    await using instance = await introspectWorkflowInstance(
        env.AUTO_ASSEMBLY_WORKFLOW,
        id
    );
    await instance.modify(async (m) => {
        await m.disableRetryDelays();
    });
    await env.AUTO_ASSEMBLY_WORKFLOW.create({ id, params });
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
            key.name.startsWith("auto-assembly") ||
            key.name.startsWith("assembly-job")
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

describe("AutoAssemblyWorkflow", () => {
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

        expect(status.state).toBe(AssemblyJobState.COMPLETE);
        // Nothing to replace
        expect(status.tasks?.map((task) => task.state)).toEqual([
            AssemblyTaskState.DONE,
            AssemblyTaskState.SKIPPED,
            AssemblyTaskState.DONE,
            AssemblyTaskState.DONE
        ]);
        expect(status.holes?.[0]).toMatchObject({
            status: HoleStatus.READY,
            screw: { length: "IN_1" }
        });
        // Washer, screw, washer, nut
        expect(status.result).toEqual({
            inserted: 4,
            fastened: 4,
            replaced: 0
        });
        expect(assemblyJobOutcome(status)).toBe(AssemblyJobOutcome.SUCCESS);

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

    it("records each part it inserted as a fastened Auto Assembly insert", async () => {
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
                InsertSource.AUTO_ASSEMBLY,
                true,
                true,
                "user"
            ])
        );
        const [day] = await db.select().from(dailyMetrics).all();
        expect(day).toMatchObject({
            count: 3,
            fastenableCount: 3,
            autoAssemblyCount: 3,
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
                "remove",
                "insert",
                "fasten"
            ]);
            // A screw and a nut in each
            expect(status.result).toEqual({
                inserted: 4,
                fastened: 4,
                replaced: 0
            });
            ["a", "a-far", "b", "b-far"].forEach((edge, index) =>
                expect(mates[index]).toContain(`"deterministicIds":["${edge}"]`)
            );
            expect(assemblyJobOutcome(status)).toBe(AssemblyJobOutcome.SUCCESS);
        });
    });

    describe("replacing", () => {
        const deleted = () =>
            vi.mocked(Assemblies.deleteAssemblyInstances).mock.calls;

        beforeEach(() => {
            const indexHoles = IndexHoles.indexHoles;
            vi.spyOn(IndexHoles, "indexHoles").mockImplementation(
                async (...args) => ({
                    ...(await indexHoles(...args)),
                    replacements: [
                        {
                            key: "top|TOP-top",
                            instanceIds: ["oldScrew", "oldNut"]
                        }
                    ]
                })
            );
            vi.spyOn(Assemblies, "deleteAssemblyInstances").mockResolvedValue();
            vi.spyOn(Assemblies, "getAssemblyFeatures").mockResolvedValue({
                features: [
                    {
                        featureId: "oldMate",
                        featureType: "mate",
                        parameters: [{ queries: [{ path: ["oldScrew"] }] }]
                    },
                    {
                        featureId: "otherMate",
                        featureType: "mate",
                        parameters: [{ queries: [{ path: ["bracket"] }] }]
                    }
                ]
            });
            vi.spyOn(Assemblies, "deleteAssemblyFeature").mockResolvedValue();
        });

        it("takes out a replaced screw's parts and their mates, then fastens its hole again", async () => {
            const status = await run("replaced", {
                sessionId: "session",
                userId: "user",
                request: BODY
            });

            expect(status.tasks?.map((task) => task.state)).toEqual([
                AssemblyTaskState.DONE,
                AssemblyTaskState.DONE,
                AssemblyTaskState.DONE,
                AssemblyTaskState.DONE
            ]);
            expect(deleted()).toHaveLength(1);
            expect(deleted()[0][2]).toEqual(["oldScrew", "oldNut"]);
            expect(
                vi
                    .mocked(Assemblies.deleteAssemblyFeature)
                    .mock.calls.map((call) => call[2])
            ).toEqual(["oldMate"]);
            expect(status.result).toEqual({
                inserted: 2,
                fastened: 2,
                replaced: 1
            });
        });

        it("keeps a replaced screw whose hole has no new plan", async () => {
            vi.spyOn(Planner, "planHoles").mockReturnValue([]);
            const status = await run("kept", {
                sessionId: "session",
                userId: "user",
                request: BODY
            });

            expect(deleted()).toHaveLength(0);
            expect(status.tasks?.[1].state).toBe(AssemblyTaskState.SKIPPED);
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

        expect(status.tasks?.[3]).toMatchObject({
            state: AssemblyTaskState.FAILED,
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
            state: AssemblyTaskState.FAILED,
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
            AssemblyTaskState.FAILED,
            AssemblyTaskState.SKIPPED,
            AssemblyTaskState.SKIPPED,
            AssemblyTaskState.SKIPPED
        ]);
        expect(status.tasks?.[0].reason).toBe(
            "You don't have permission to edit this assembly."
        );
        expect(Assemblies.insertTransformedInstances).not.toHaveBeenCalled();
        expect(assemblyJobOutcome(status)).toBe(AssemblyJobOutcome.FAILED);
    });
});
