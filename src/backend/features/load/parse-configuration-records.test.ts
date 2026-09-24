import { afterEach, describe, expect, it, vi } from "vitest";
import * as PartsEndpoints from "../../lib/onshape/endpoints/parts";
import * as MetadataEndpoints from "../../lib/onshape/endpoints/metadata";
import { OnshapeApi } from "../../lib/onshape/client";
import type {
    OnshapeMetadataObject,
    OnshapePart
} from "../../lib/onshape/types";
import { ElementPath } from "../../lib/onshape/path";
import {
    type ConfigurationParameter,
    type PartialSelection,
    type Selection
} from "../configurations/contract";
import {
    enumParam,
    paramsWithConfigs
} from "../../../__test_utils__/configuration-fixtures";
import { ElementType } from "../../lib/onshape/element-type";
import { BuildIssueType } from "../build-checker/issues";
import { Vendor } from "../library/vendors";
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

const NO_SETTINGS = { indexConfigurations: false, excludedParameterIds: [] };
const MANY = [{ type: BuildIssueType.MANUAL_INDEXING_REQUIRED }];
const TOO_MANY = [{ type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }];

describe("decideIndexing", () => {
    it.each([
        // Below the auto line it indexes on its own.
        { configs: 127, force: false, index: true, issues: [] },
        // At the line it waits, flagged so an admin can trim or enable it.
        { configs: 128, force: false, index: false, issues: MANY },
        // Enabling it overrides the count, and clears the flag.
        { configs: 128, force: true, index: true, issues: [] },
        // Past the cap there is nothing to enumerate, forced or not.
        { configs: 600, force: false, index: false, issues: TOO_MANY },
        { configs: 600, force: true, index: false, issues: TOO_MANY }
    ])("configs=$configs force=$force", ({ configs, force, index, issues }) => {
        const { shouldIndex, buildIssues } = decideIndexing(
            ElementType.PART_STUDIO,
            paramsWithConfigs(configs),
            { indexConfigurations: force, excludedParameterIds: [] }
        );
        expect({ shouldIndex, buildIssues }).toEqual({
            shouldIndex: index,
            buildIssues: issues
        });
    });

    it("indexes an assembly the way it does a part studio", () => {
        const decision = decideIndexing(
            ElementType.ASSEMBLY,
            paramsWithConfigs(3),
            NO_SETTINGS
        );
        expect(decision.shouldIndex).toBe(true);
        expect(decision.configurations).toHaveLength(3);
    });

    it("waits on an admin for an assembly past the threshold", () => {
        expect(
            decideIndexing(ElementType.ASSEMBLY, paramsWithConfigs(128), {
                ...NO_SETTINGS,
                indexConfigurations: true
            }).shouldIndex
        ).toBe(true);
    });

    it("applies exclusions to a part studio but not an assembly", () => {
        const parameters = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2"])
        ];
        const settings = { ...NO_SETTINGS, excludedParameterIds: ["B"] };
        expect(
            decideIndexing(ElementType.PART_STUDIO, parameters, settings)
                .configurations
        ).toHaveLength(2);
        expect(
            decideIndexing(ElementType.ASSEMBLY, parameters, settings)
                .configurations
        ).toHaveLength(4);
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
            values: { size: "L" },
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
            values: { size: "S" },
            hasMultipleParts: false,
            // The composite it was expected to resolve to is gone.
            isOpenComposite: false
        });
    });

    it("returns an all-null record for an empty response", () => {
        expect(parsePartStudioRecord([], { A: "a1" }, false)).toEqual({
            values: { A: "a1" },
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
            values: { q: "1" },
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

/** Parts derive from the overrides alone, as Onshape defaults the rest. */
function mockParts(partsFor: (overrides: Selection) => OnshapePart[]) {
    return vi
        .spyOn(PartsEndpoints, "getParts")
        .mockImplementation((_client, _path, configuration) =>
            Promise.resolve(partsFor(configuration))
        );
}

/** The combinations the load would probe, as enumeration names them. */
function probeSelections(
    parameters: ConfigurationParameter[],
    elementType: ElementType = ElementType.PART_STUDIO
): PartialSelection[] {
    return decideIndexing(elementType, parameters, {
        indexConfigurations: true,
        excludedParameterIds: []
    }).configurations;
}

/** Probes an element the way the load does: its own combinations, in full. */
function probeRecords(
    parameters: ConfigurationParameter[],
    options: { elementType?: ElementType; isOpenComposite?: boolean } = {}
) {
    const elementType = options.elementType ?? ElementType.PART_STUDIO;
    return parseConfigurationRecords(
        CLIENT,
        {
            elementPath: PATH,
            elementType,
            isOpenComposite: options.isOpenComposite ?? false
        },
        parameters,
        probeSelections(parameters, elementType)
    );
}

describe("parseConfigurationRecords", () => {
    it("returns the element's part data plus a record per configuration", async () => {
        mockParts((configuration) => [
            { partId: "p", partNumber: `PN-${configuration.A ?? "default"}` }
        ]);

        const result = await probeRecords([enumParam("A", ["a1", "a2"])]);

        expect(result.buildIssues).toEqual([]);
        // "a1" is A's default, so that combination repeats the default probe.
        expect(result.partMetadata?.partNumber).toBe("PN-default");
        expect(result.records.map((r) => r.partNumber)).toEqual(["PN-a2"]);
    });

    it("stores the values each record was probed with", async () => {
        mockParts(() => [{ partId: "p", partNumber: "PN" }]);

        const result = await probeRecords([enumParam("A", ["a1", "a2"])]);

        expect(result.records.map((record) => record.values)).toEqual([
            { A: "a2" }
        ]);
    });

    it("fills the vendor Onshape leaves unset, per configuration", async () => {
        // Onshape reports no vendor; the option each record selected names it.
        mockParts((configuration) => [
            { partId: "p", partNumber: `PN-${configuration.Vendor ?? "wcp"}` }
        ]);
        const vendorParam = enumParam("Vendor", ["wcp", "am"]);

        const result = await probeRecords([vendorParam]);

        expect(result.partMetadata?.vendor).toBe(Vendor.WCP);
        expect(result.records.map((r) => r.vendor)).toEqual([Vendor.AM]);
    });

    it("keeps the vendor Onshape does report", async () => {
        mockParts(() => [
            { partId: "p", partNumber: "PN", vendor: "AndyMark", name: "WCP" }
        ]);

        const result = await probeRecords([]);

        expect(result.partMetadata?.vendor).toBe("AndyMark");
    });

    it("probes every combination when none of them is the default", async () => {
        mockParts((configuration) => [
            { partId: "p", partNumber: `PN-${configuration.A ?? "default"}` }
        ]);

        const result = await probeRecords([
            { ...enumParam("A", ["a1", "a2"]), default: "a2" }
        ]);

        expect(result.partMetadata?.partNumber).toBe("PN-default");
        expect(result.records.map((r) => r.partNumber)).toEqual(["PN-a1"]);
    });

    // The defaults hold, so only the breaking configurations are at fault.
    it("blames the configurations that resolve to more than one part", async () => {
        mockParts((configuration) =>
            configuration.A === "a2" || configuration.A === "a3"
                ? [
                      { partId: "p1", partNumber: "PN-1" },
                      { partId: "p2", partNumber: "PN-2" }
                  ]
                : [{ partId: "p1", partNumber: "PN-1" }]
        );

        const result = await probeRecords([enumParam("A", ["a1", "a2", "a3"])]);

        expect(result.buildIssues).toEqual([
            {
                type: BuildIssueType.CONFIGURATION_MULTIPLE_PARTS,
                values: { A: "a2" },
                configurationCount: 2
            }
        ]);
    });

    // Every configuration inherits a broken default.
    it("blames the part itself when its own defaults resolve to more than one part", async () => {
        mockParts(() => [
            { partId: "p1", partNumber: "PN-1" },
            { partId: "p2", partNumber: "PN-2" }
        ]);

        const result = await probeRecords([enumParam("A", ["a1", "a2"])]);

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.MULTIPLE_PARTS }
        ]);
    });

    it("blames the configuration that loses the part studio's composite", async () => {
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

        const result = await probeRecords([enumParam("A", ["a1", "a2"])], {
            isOpenComposite: true
        });

        expect(result.buildIssues).toEqual([
            {
                type: BuildIssueType.UNSTABLE_COMPOSITE,
                values: { A: "a2" },
                configurationCount: 1
            }
        ]);
    });

    it("records just the default when there are no combinations", async () => {
        const spy = mockParts(() => [
            { partId: "p", partNumber: "PN-default" }
        ]);

        const result = await probeRecords(paramsWithConfigs(600));

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

        const result = await probeRecords([], {
            elementType: ElementType.ASSEMBLY
        });

        expect(result.records).toEqual([]);
        expect(result.partMetadata).toEqual({
            partNumber: "AM-1",
            hasMultipleParts: false,
            isOpenComposite: false
        });
        expect(spy).toHaveBeenCalledWith(CLIENT, PATH, {});
    });
});
