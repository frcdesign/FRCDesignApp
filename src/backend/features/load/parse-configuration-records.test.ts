import { afterEach, describe, expect, it, vi } from "vitest";
import { countConfigurations } from "../configurations/combinations";
import * as PartsEndpoints from "../../lib/onshape/endpoints/parts";
import * as MetadataEndpoints from "../../lib/onshape/endpoints/metadata";
import { OnshapeApi } from "../../lib/onshape/client";
import type {
    OnshapeMetadataObject,
    OnshapePart
} from "../../lib/onshape/types";
import { ElementPath } from "../../lib/onshape/path";
import {
    ParameterValues,
    ConfigurationParameter
} from "../configurations/models";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";
import { ElementType } from "../../lib/onshape/element-type";
import { BuildIssueType } from "../build-checker/issues";
import {
    decideIndexing,
    parseAssemblyRecord,
    parseConfigurationRecords,
    parsePartStudioRecord
} from "./parse-configuration-records";

const PATH: ElementPath = {
    documentId: "d",
    instanceId: "v",
    instanceType: "v",
    elementId: "e"
};

/** The client is only forwarded to the endpoint wrappers, which are mocked. */
const CLIENT = {} as OnshapeApi;

afterEach(() => vi.restoreAllMocks());

/** A single enum whose N options make the element enumerate to N configurations. */
function paramsWithConfigs(count: number): ConfigurationParameter[] {
    return [
        enumParam(
            "A",
            Array.from({ length: count }, (_, i) => `o${i}`)
        )
    ];
}

const MANY = [{ type: BuildIssueType.MANUAL_INDEXING_REQUIRED }];
const TOO_MANY = [{ type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }];

describe("decideIndexing", () => {
    // Vendors no longer enter into it: the configuration count is the only gate.
    it.each([
        // Below the auto line it indexes on its own.
        { configs: 127, force: false, index: true, issues: [] },
        // At the line it waits, flagged so an admin can trim or enable it.
        { configs: 128, force: false, index: false, issues: MANY },
        // Enabling it overrides the count, and clears the flag.
        { configs: 128, force: true, index: true, issues: [] },
        // Past the hard cap there is nothing to enumerate, so enabling it can't
        // help — it stays unindexed and flagged either way.
        { configs: 600, force: false, index: false, issues: TOO_MANY },
        { configs: 600, force: true, index: false, issues: TOO_MANY }
    ])("configs=$configs force=$force", ({ configs, force, index, issues }) => {
        const { shouldIndex, buildIssues } = decideIndexing(
            paramsWithConfigs(configs),
            force
        );
        expect({ shouldIndex, buildIssues }).toEqual({
            shouldIndex: index,
            buildIssues: issues
        });
    });
});

describe("parsePartStudioRecord", () => {
    it("reads the single part's metadata into the record", () => {
        expect(
            parsePartStudioRecord(
                [
                    {
                        partId: "p",
                        partNumber: "  217-2600 ",
                        name: "Bracket",
                        description: "A bracket",
                        material: { displayName: "6061 Aluminum" },
                        vendor: "AM"
                    }
                ],
                { size: "L" },
                false
            )
        ).toEqual({
            configuration: { size: "L" },
            partNumber: "217-2600",
            name: "Bracket",
            description: "A bracket",
            material: "6061 Aluminum",
            vendor: "AM",
            hasMultipleParts: false,
            isOpenComposite: false
        });
    });

    it("reads the first part and flags more than one, when not a composite", () => {
        const record = parsePartStudioRecord(
            [
                { partId: "a", partNumber: "217-2601" },
                { partId: "b", partNumber: "217-2602" }
            ],
            {},
            false
        );
        expect(record.partNumber).toBe("217-2601");
        expect(record.hasMultipleParts).toBe(true);
    });

    it("reads the composite when the studio is an open composite", () => {
        const record = parsePartStudioRecord(
            [
                { partId: "a", partNumber: "loose" },
                { partId: "c", partNumber: "COMP-1", bodyType: "composite" }
            ],
            {},
            true
        );
        expect(record.partNumber).toBe("COMP-1");
        expect(record.hasMultipleParts).toBe(false);
        expect(record.isOpenComposite).toBe(true);
    });

    it("flags an unstable composite when a configuration loses its composite", () => {
        expect(
            parsePartStudioRecord(
                [{ partId: "a", partNumber: "loose" }],
                { size: "S" },
                true
            )
        ).toEqual({
            configuration: { size: "S" },
            hasMultipleParts: false,
            // The composite it was expected to resolve to is gone.
            isOpenComposite: false
        });
    });

    it("returns an all-null record for an empty response", () => {
        expect(parsePartStudioRecord([], { A: "a1" }, false)).toEqual({
            configuration: { A: "a1" },
            partNumber: undefined,
            name: undefined,
            description: undefined,
            material: undefined,
            vendor: undefined,
            hasMultipleParts: false,
            isOpenComposite: false
        });
    });
});

describe("parseAssemblyRecord", () => {
    it("pulls the stored fields out of the metadata property bag", () => {
        const metadata: OnshapeMetadataObject = {
            properties: [
                { name: "Part number", value: " AM-1234 " },
                { name: "Name", value: "Gearbox" },
                { name: "Description", value: "A gearbox" },
                { name: "Material", value: { displayName: "Steel" } },
                { name: "Vendor", value: "AM" },
                // Not one of the fields we store — ignored.
                { name: "State", value: "In Progress" }
            ]
        };
        expect(parseAssemblyRecord(metadata, { q: "1" })).toEqual({
            configuration: { q: "1" },
            partNumber: "AM-1234",
            name: "Gearbox",
            description: "A gearbox",
            material: "Steel",
            vendor: "AM",
            hasMultipleParts: false,
            isOpenComposite: false
        });
    });
});

/** Mocks the parts endpoint, deriving a studio's parts from the configuration. */
function mockParts(
    partsFor: (configuration: ParameterValues) => OnshapePart[]
) {
    return vi
        .spyOn(PartsEndpoints, "getParts")
        .mockImplementation((_client, _path, configuration) =>
            Promise.resolve(partsFor(configuration))
        );
}

describe("parseConfigurationRecords", () => {
    it("returns the element's part data plus a record per configuration", async () => {
        mockParts((configuration) => [
            { partId: "p", partNumber: `PN-${configuration.A ?? "default"}` }
        ]);

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            countConfigurations([enumParam("A", ["a1", "a2"])]).configurations,
            false
        );

        expect(result.buildIssues).toEqual([]);
        // "a1" is A's default, so that combination is the element's own probe
        // under another name and is not probed again.
        expect(result.partMetadata?.partNumber).toBe("PN-default");
        expect(result.records.map((r) => r.partNumber)).toEqual(["PN-a2"]);
    });

    it("probes every combination when none of them is the default", async () => {
        mockParts((configuration) => [
            { partId: "p", partNumber: `PN-${configuration.A ?? "default"}` }
        ]);

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [{ ...enumParam("A", ["a1", "a2"]), default: "a2" }],
            countConfigurations([
                { ...enumParam("A", ["a1", "a2"]), default: "a2" }
            ]).configurations,
            false
        );

        expect(result.partMetadata?.partNumber).toBe("PN-default");
        expect(result.records.map((r) => r.partNumber)).toEqual(["PN-a1"]);
    });

    it("flags a studio with more than one part in any configuration", async () => {
        mockParts((configuration) =>
            configuration.A === "a2"
                ? [
                      { partId: "p1", partNumber: "PN-1" },
                      { partId: "p2", partNumber: "PN-2" }
                  ]
                : [{ partId: "p1", partNumber: "PN-1" }]
        );

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            countConfigurations([enumParam("A", ["a1", "a2"])]).configurations,
            false
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.MULTIPLE_PARTS }
        ]);
    });

    it("flags an unstable composite when a configuration loses its composite", async () => {
        mockParts((configuration) =>
            configuration.A === "a2"
                ? [{ partId: "p", partNumber: "PN-2" }]
                : [
                      {
                          partId: "c",
                          partNumber: "COMP",
                          bodyType: "composite"
                      },
                      { partId: "p", partNumber: "loose" }
                  ]
        );

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            countConfigurations([enumParam("A", ["a1", "a2"])]).configurations,
            true
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.UNSTABLE_COMPOSITE }
        ]);
    });

    // Past the cap decideIndexing turns indexing off and raises the issue, so
    // this only ever runs with nothing to enumerate.
    it("records just the default when there are no combinations", async () => {
        const spy = mockParts(() => [
            { partId: "p", partNumber: "PN-default" }
        ]);

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            paramsWithConfigs(600),
            countConfigurations(paramsWithConfigs(600)).configurations,
            false
        );

        expect(result.buildIssues).toEqual([]);
        expect(result.records).toHaveLength(0);
        expect(result.partMetadata?.partNumber).toBe("PN-default");
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("indexes an assembly through its element metadata", async () => {
        const spy = vi
            .spyOn(MetadataEndpoints, "getElementMetadata")
            .mockResolvedValue({
                properties: [{ name: "Part number", value: "AM-1" }]
            });

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.ASSEMBLY,
            [],
            countConfigurations([]).configurations,
            false
        );

        expect(result.records).toEqual([]);
        expect(result.partMetadata).toEqual({
            partNumber: "AM-1",
            name: undefined,
            description: undefined,
            material: undefined,
            vendor: undefined,
            hasMultipleParts: false,
            isOpenComposite: false
        });
        expect(spy).toHaveBeenCalledWith(CLIENT, PATH, {});
    });
});
