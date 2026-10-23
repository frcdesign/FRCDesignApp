import { env } from "cloudflare:workers";
import { introspectWorkflowInstance } from "cloudflare:test";
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
import * as Studios from "./studios";
import { FastenerKind } from "./studios";

const WASHER = { vendor: "GENERIC", size: "NO_10_32", type: "OD_1_2_X_0_049" };
import {
    FastenerJobOutcome,
    fastenerJobOutcome,
    FastenerJobState,
    FastenerTaskState,
    HoleEnd,
    HoleStatus,
    type FastenerJobStatus
} from "./contract";
import { getJobStatus } from "./jobs";
import type { FastenerJobParams } from "./workflow";

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
    vi.spyOn(Studios, "getStudioLocation").mockImplementation((kind) => ({
        documentId: "lib",
        versionId: "libv",
        elementId: `${kind}Studio`
    }));
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
        expect(status.result).toEqual({
            inserted: 4,
            fastened: 4,
            replicated: 0
        });
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

    describe("replicating", () => {
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
        const REPLICATING = {
            sessionId: "session",
            request: { ...BODY, options: { ...BODY.options, replicate: true } }
        };

        beforeEach(() => {
            vi.spyOn(Planner, "planHoles").mockReturnValue([
                alike("a"),
                alike("b")
            ]);
        });

        it("gives the first of alike holes parts, and replicates each stack onto the rest", async () => {
            const status = await run("replicated", REPLICATING);

            expect(status.tasks?.map((task) => task.action)).toEqual([
                "index",
                "insert",
                "fasten",
                "replicate"
            ]);
            // A screw and a nut in `a`
            expect(status.result).toEqual({
                inserted: 2,
                fastened: 2,
                replicated: 1
            });
            const [screws, nuts] = mates.slice(2);
            expect(screws).toContain('"featureType":"replicate"');
            expect(screws).toContain('"parameterId":"targetEdges"');
            expect(screws).toContain('"deterministicIds":["b"]');
            expect(screws).toContain(
                '"seedInstances","queries":[{"btType":"BTMIndividualOccurrenceQuery-626","path":["part0"]}]'
            );
            expect(nuts).toContain('"deterministicIds":["b-far"]');
            expect(nuts).toContain(
                '"seedInstances","queries":[{"btType":"BTMIndividualOccurrenceQuery-626","path":["part1"]}]'
            );
            expect(fastenerJobOutcome(status)).toBe(FastenerJobOutcome.SUCCESS);
        });

        it("fails the step, in Onshape's words, when Onshape refuses the replicate", async () => {
            vi.mocked(Assemblies.addAssemblyFeature).mockImplementation(
                (_client, _path, feature) => {
                    const json = JSON.stringify(feature);
                    if (json.includes('"featureType":"replicate"')) {
                        return Promise.reject(
                            new OnshapeApiError(
                                "Onshape API error 400: bad feature",
                                400
                            )
                        );
                    }
                    mates.push(json);
                    return Promise.resolve({ feature: { featureId: "mate" } });
                }
            );
            const status = await run("refused", REPLICATING);

            expect(status.tasks?.map((task) => task.state)).toEqual([
                FastenerTaskState.DONE,
                FastenerTaskState.DONE,
                FastenerTaskState.DONE,
                FastenerTaskState.FAILED
            ]);
            expect(status.tasks?.[3].reason).toBe(
                "Onshape refused the Replicate (Onshape API error 400: bad feature)."
            );
            expect(status.result).toEqual({
                inserted: 2,
                fastened: 2,
                replicated: 0
            });
            expect(fastenerJobOutcome(status)).toBe(FastenerJobOutcome.PARTIAL);
        });
    });

    it("stops before inserting when Onshape refuses to read the assembly", async () => {
        vi.mocked(Assemblies.getAssembly).mockRejectedValue(
            new OnshapeApiError("Onshape API error 403: Forbidden", 403)
        );
        const status = await run("forbidden", {
            sessionId: "session",
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
