import { describe, expect, it } from "vitest";
import { ElementType } from "../../../lib/onshape/element-type";
import { FastenInfo, MateLocation } from "./fasten";
import { getFastenQuery } from "./fasten-query";

describe("getFastenQuery", () => {
    const fasten: FastenInfo = {
        mateConnectorId: "mc",
        mateLocation: MateLocation.Feature,
        path: ["fp"]
    };

    it("builds a part-studio mate connector query for a part studio target", () => {
        expect(getFastenQuery(ElementType.PART_STUDIO, ["np"], fasten)).toEqual(
            {
                btType: "BTMPartStudioMateConnectorQuery-1324",
                featureId: "mc",
                path: ["np"]
            }
        );
    });

    it("uses a part-studio query for a Part mate in an assembly (combined path)", () => {
        const partFasten: FastenInfo = {
            mateConnectorId: "mc",
            mateLocation: MateLocation.Part,
            path: ["fp"]
        };
        expect(
            getFastenQuery(ElementType.ASSEMBLY, ["np"], partFasten)
        ).toEqual({
            btType: "BTMPartStudioMateConnectorQuery-1324",
            featureId: "mc",
            path: ["np", "fp"]
        });
    });

    it("uses a feature-occurrence query for a Feature mate in an assembly", () => {
        expect(getFastenQuery(ElementType.ASSEMBLY, ["np"], fasten)).toEqual({
            btType: "BTMFeatureQueryWithOccurrence-157",
            path: ["np", "fp"],
            queryData: "",
            featureId: "mc"
        });
    });
});
