import { afterEach, describe, expect, it, vi } from "vitest";
import * as PartsEndpoints from "../onshape-api/endpoints/parts";
import * as MetadataEndpoints from "../onshape-api/endpoints/metadata";
import { OnshapeApi } from "../onshape-api/onshape-api";
import type {
    OnshapeMetadataObject,
    OnshapePart
} from "../onshape-api/onshape-types";
import { ElementPath } from "../../shared/onshape-path";
import {
    ParameterValues,
    ConfigurationParameter
} from "../../shared/configuration-models";
import { enumParam } from "../../__test_utils__/configuration-fixtures";
import { ElementType, Vendor } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-issues";
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

const MANY = [{ type: BuildIssueType.MANY_CONFIGURATIONS }];
const TOO_MANY = [{ type: BuildIssueType.TOO_MANY_CONFIGURATIONS }];

describe("decideIndexing", () => {
    it.each([
        // A vendor part below the auto line indexes on its own.
        {
            vendors: [Vendor.AM],
            configs: 127,
            force: false,
            index: true,
            issues: []
        },
        // At the line it waits, flagged so an admin can trim or enable it.
        {
            vendors: [Vendor.AM],
            configs: 128,
            force: false,
            index: false,
            issues: MANY
        },
        // Enabling it overrides the count, and clears the flag.
        {
            vendors: [Vendor.AM],
            configs: 128,
            force: true,
            index: true,
            issues: []
        },
        // Past the hard cap there is nothing to enumerate, so enabling it can't
        // help — it stays unindexed and flagged either way.
        {
            vendors: [Vendor.AM],
            configs: 600,
            force: false,
            index: false,
            issues: TOO_MANY
        },
        {
            vendors: [Vendor.AM],
            configs: 600,
            force: true,
            index: false,
            issues: TOO_MANY
        },
        // No vendor: never auto-eligible, never flagged, but still enableable.
        { vendors: [], configs: 50, force: false, index: false, issues: [] },
        { vendors: [], configs: 50, force: true, index: true, issues: [] },
        // Nor flagged for a count it was never going to index against...
        { vendors: [], configs: 200, force: false, index: false, issues: [] },
        { vendors: [], configs: 600, force: false, index: false, issues: [] },
        // ...unless an admin enabled it and is owed the reason it did nothing.
        {
            vendors: [],
            configs: 600,
            force: true,
            index: false,
            issues: TOO_MANY
        }
    ])(
        "vendors=$vendors configs=$configs force=$force",
        ({ vendors, configs, force, index, issues }) => {
            expect(
                decideIndexing(vendors, paramsWithConfigs(configs), force)
            ).toEqual({ shouldIndex: index, buildIssues: issues });
        }
    );
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
            isUnstableComposite: false
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
        expect(record.isUnstableComposite).toBe(false);
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
            partNumber: null,
            name: null,
            description: null,
            material: null,
            vendor: null,
            hasMultipleParts: false,
            isUnstableComposite: true
        });
    });

    it("returns an all-null record for an empty response", () => {
        expect(parsePartStudioRecord([], { A: "a1" }, false)).toEqual({
            configuration: { A: "a1" },
            partNumber: null,
            name: null,
            description: null,
            material: null,
            vendor: null,
            hasMultipleParts: false,
            isUnstableComposite: false
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
            isUnstableComposite: false
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
    it("returns a record per configuration, default first, in enumeration order", async () => {
        mockParts((configuration) => [
            { partId: "p", partNumber: `PN-${configuration.A ?? "default"}` }
        ]);

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            false
        );

        expect(result.buildIssues).toEqual([]);
        expect(result.records.map((r) => r.partNumber)).toEqual([
            "PN-default",
            "PN-a1",
            "PN-a2"
        ]);
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
            true
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.UNSTABLE_COMPOSITE }
        ]);
    });

    it("flags capped enumeration but still records the default", async () => {
        const spy = mockParts(() => [
            { partId: "p", partNumber: "PN-default" }
        ]);

        const result = await parseConfigurationRecords(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            paramsWithConfigs(600),
            false
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.TOO_MANY_CONFIGURATIONS }
        ]);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].partNumber).toBe("PN-default");
        // Only the default probe; the combinations are never fetched.
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
            false
        );

        expect(result.records).toEqual([
            {
                configuration: {},
                partNumber: "AM-1",
                name: null,
                description: null,
                material: null,
                vendor: null,
                hasMultipleParts: false,
                isUnstableComposite: false
            }
        ]);
        expect(spy).toHaveBeenCalledWith(CLIENT, PATH, {});
    });
});
