import { loggedEvents } from "../../../__test_utils__";
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
    plateScan,
    workspaceElements
} from "../../../__test_utils__/auto-assembly-fixtures";
import * as RequestAuth from "../auth/request-auth";
import * as Assemblies from "../../lib/onshape/endpoints/assemblies";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as PartStudios from "../../lib/onshape/endpoints/part-studios";
import { OnshapeApiError, type OAuthApi } from "../../lib/onshape/client";
import * as Planner from "./planner";
import * as IndexHoles from "./index-holes";
import { FastenerKind } from "./studios";
import { MateLocation } from "../library/insertables/fasten";

const WASHER = { vendor: "GENERIC", size: "NO_10_32", type: "OD_1_2_X_0_049" };
import {
    AssemblyJobOutcome,
    assemblyJobOutcome,
    AssemblyJobState,
    AssemblyRunKind,
    DeclaredPartStatus,
    AssemblyTaskAction,
    AssemblyTaskState,
    HoleEnd,
    HoleStatus,
    RunPartRole,
    PickList,
    ProblemSeverity,
    SelectedEntityType,
    type AssemblyJobStatus
} from "./contract";
import { getJobStatus } from "./jobs";
import type { AssemblyJobParams } from "./workflow";
import { getDb } from "../../db/client";
import { dailyMetrics } from "../analytics/schema";
import { configurations } from "../../db/schema";
import { UseSource } from "../analytics/usage";
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
    vi.spyOn(Documents, "getElements").mockResolvedValue(workspaceElements());
    vi.spyOn(PartStudios, "evaluateFeatureScript").mockImplementation(
        (_client, path, script) =>
            Promise.resolve({
                result:
                    path.elementId === "topStudio"
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
            screw: { length: "IN_0_875" }
        });
        // Each part with the screw it goes with, as inserted and fastened
        expect(status.screws).toEqual([
            {
                hole: status.holes?.[0].key,
                isUpdate: false,
                parts: [
                    RunPartRole.SCREW_WASHER,
                    RunPartRole.SCREW,
                    RunPartRole.NUT_WASHER,
                    RunPartRole.NUT
                ].map((role, index) => ({
                    role,
                    path: [`part${index}`],
                    isFastened: true
                }))
            }
        ]);
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
            '"featureId":"washerTopMC","path":["part0"]'
        );
        expect(mates[2]).toContain('"deterministicIds":["BOTTOM-bottom"]');
        expect(mates[3]).toContain(
            '"featureId":"washerTopMC","path":["part2"]'
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

        const recorded = loggedEvents();
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
                UseSource.AUTO_ASSEMBLY,
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

    it("places each declared part on its connector, and records it as a FeatureScript part", async () => {
        const db = getDb(env.DB);
        await seedGroup(db);
        await seedInsertable(db, {
            id: "bearing-row",
            documentId: "lib",
            versionId: "libv",
            elementId: "bearings",
            fastenInfo: {
                mateConnectorId: "Fset.mateConnector",
                mateLocation: MateLocation.Feature,
                path: []
            }
        });
        const declaring = (name: string, documentId: string) =>
            fs.map({
                partId: fs.string("TOP"),
                connectorId: fs.string(`F${name}.place.mateConnector`),
                origin: fs.vector([0, 0, 0]),
                xAxis: fs.vector([1, 0, 0]),
                zAxis: fs.vector([0, 0, 1]),
                declaration: fs.map({
                    version: fs.number(1),
                    kind: fs.string("BEARING"),
                    documentId: fs.string(documentId),
                    elementId: fs.string("bearings"),
                    configuration: fs.map({}),
                    name: fs.string(name),
                    connector: fs.string("mateConnector"),
                    spec: fs.map({})
                })
            });
        vi.mocked(PartStudios.evaluateFeatureScript).mockImplementation(
            (_client, path) =>
                Promise.resolve({
                    result: fs.map({
                        connectors: fs.array(
                            path.elementId === "topStudio"
                                ? [
                                      declaring("Bearing", "lib"),
                                      declaring("Elsewhere", "other")
                                  ]
                                : []
                        )
                    })
                })
        );

        const status = await run("declared", {
            sessionId: "session",
            userId: "user",
            kind: AssemblyRunKind.DECLARED_PARTS,
            request: { assembly: ASSEMBLY }
        });

        expect(status.kind).toBe(AssemblyRunKind.DECLARED_PARTS);
        expect(status.tasks?.map((task) => task.state)).toEqual([
            AssemblyTaskState.DONE,
            AssemblyTaskState.SKIPPED,
            AssemblyTaskState.DONE,
            AssemblyTaskState.DONE
        ]);
        expect(status.tasks?.[0].warning).toBe("1 part can't be placed.");
        expect(status.declared).toEqual([
            {
                key: "top|FBearing.place.mateConnector",
                name: "Bearing",
                status: DeclaredPartStatus.READY,
                hostPath: ["top"],
                canFlip: false,
                path: ["part0"],
                isFastened: true
            },
            {
                key: "top|FElsewhere.place.mateConnector",
                name: "Elsewhere",
                status: DeclaredPartStatus.UNPLACEABLE,
                reason: "FRCDesign's library doesn't have this part.",
                hostPath: ["top"],
                canFlip: false
            }
        ]);
        expect(status.result).toEqual({
            inserted: 1,
            fastened: 1,
            replaced: 0
        });
        expect(assemblyJobOutcome(status)).toBe(AssemblyJobOutcome.PARTIAL);
        expect(mates).toHaveLength(1);
        expect(mates[0]).toContain(
            '"featureId":"Fset.mateConnector","path":["part0"]'
        );
        expect(mates[0]).toContain(
            '"featureId":"FBearing.place.mateConnector","path":["top"]'
        );
        expect(
            loggedEvents().map((event) => [
                event.elementId,
                event.source,
                event.fasten
            ])
        ).toEqual([["bearings", UseSource.FEATURESCRIPT_PARTS, true]]);
    });

    it("sizes a declared screw through what's under it, with its declared nut, and fastens both", async () => {
        const db = getDb(env.DB);
        await seedGroup(db);
        for (const kind of [FastenerKind.SCREW, FastenerKind.NUT]) {
            await seedInsertable(db, {
                id: `${kind}-row`,
                documentId: "lib",
                versionId: "libv",
                elementId: `${kind}Studio`,
                fastenInfo: {
                    mateConnectorId: `${kind}MC`,
                    mateLocation: MateLocation.Feature,
                    path: []
                }
            });
            await db
                .insert(configurations)
                .values({
                    insertableId: `${kind}-row`,
                    parameters: FASTENER_SET.studios[kind].parameters
                })
                .onConflictDoNothing();
        }
        const screw = fs.map({
            partId: fs.string("TOP"),
            connectorId: fs.string("Fhat.screws.screw1"),
            origin: fs.vector([0, 0, 0]),
            xAxis: fs.vector([1, 0, 0]),
            zAxis: fs.vector([0, 0, 1]),
            declaration: fs.map({
                version: fs.number(1),
                kind: fs.string("SCREW"),
                documentId: fs.string("lib"),
                elementId: fs.string("screwStudio"),
                configuration: fs.map({
                    vendor: fs.string("GENERIC"),
                    size: fs.string("NO_10_32"),
                    head: fs.string("BUTTON"),
                    finish: fs.string("BLACK")
                }),
                name: fs.string("#10-32 Screw"),
                connector: fs.string("mateConnector"),
                spec: fs.map({}),
                nut: fs.map({
                    documentId: fs.string("lib"),
                    elementId: fs.string("nutStudio"),
                    configuration: fs.map({ type: fs.string("NYLOCK") }),
                    name: fs.string("#10-32 Nut")
                })
            })
        });
        vi.mocked(PartStudios.evaluateFeatureScript).mockImplementation(
            (_client, path, script) =>
                Promise.resolve({
                    result: script.includes('"connectors" : connectors')
                        ? fs.map({
                              connectors: fs.array(
                                  path.elementId === "topStudio" ? [screw] : []
                              )
                          })
                        : path.elementId === "topStudio"
                          ? plateScan("TOP")
                          : plateScan("BOTTOM")
                })
        );

        const status = await run("declared-screw", {
            sessionId: "session",
            userId: "user",
            kind: AssemblyRunKind.DECLARED_PARTS,
            request: { assembly: ASSEMBLY }
        });

        expect(status.declared).toEqual([
            expect.objectContaining({
                status: DeclaredPartStatus.READY,
                path: ["part0"],
                isFastened: true,
                nut: expect.objectContaining({
                    path: ["part1"],
                    isFastened: true
                })
            })
        ]);
        expect(status.result).toMatchObject({ inserted: 2, fastened: 2 });
        // The screw on its connector, the nut under both plates
        expect(mates[0]).toContain(
            '"featureId":"Fhat.screws.screw1","path":["top"]'
        );
        expect(mates[1]).toContain('"deterministicIds":["BOTTOM-bottom"]');
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
        // Each pick, with the problem the check would have marked it with
        expect(status.picks).toEqual([
            { list: PickList.TARGETS, entity: BODY.targets[0] },
            {
                list: PickList.TARGETS,
                entity: expect.objectContaining({ occurrencePath: ["gone"] }),
                problem: {
                    message: "Couldn't find this part in the assembly.",
                    severity: ProblemSeverity.ERROR
                }
            },
            {
                list: PickList.TARGETS,
                entity: expect.objectContaining({ entityId: "TOP-face" }),
                problem: {
                    message: "Not a circular edge.",
                    severity: ProblemSeverity.ERROR
                }
            }
        ]);
        expect(
            status.tasks?.find(
                (task) => task.action === AssemblyTaskAction.INDEX
            )
        ).toMatchObject({
            state: AssemblyTaskState.DONE,
            warning: "2 picks have problems."
        });
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
