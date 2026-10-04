import { describe, expect, it, vi } from "vitest";
import { type OnshapeApi } from "../client";
import { ThumbnailSize } from "../../../features/thumbnails/contract";
import { getConfiguredThumbnail, getEncodedConfiguration } from "./thumbnails";

const WORKSPACE = {
    documentId: "ec194c001a419592e9fd55fd",
    instanceId: "c932796bcac2f7e7344a2072",
    instanceType: "w" as const,
    elementId: "8c8050a96ba6021887368f7a"
};

function fakeApi(insertables: unknown) {
    return {
        get: vi.fn().mockResolvedValue(insertables),
        getImage: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    };
}

describe("getEncodedConfiguration", () => {
    it("reads the configuration key insertables spells", async () => {
        const api = fakeApi({ items: [{}], configurationKey: "PNGGK3TH" });

        expect(
            await getEncodedConfiguration(
                api as unknown as OnshapeApi,
                WORKSPACE,
                { Length: "0.127 m" }
            )
        ).toBe("PNGGK3TH");
        expect(api.get.mock.calls[0][1]).toMatchObject({
            query: { configuration: "Length=0.127 m" }
        });
    });

    it("finds no part where insertables lists none", async () => {
        const api = fakeApi({ items: [], configurationKey: "PNGGK3TH" });

        expect(
            await getEncodedConfiguration(
                api as unknown as OnshapeApi,
                WORKSPACE,
                { Length: "-1 m" }
            )
        ).toBeUndefined();
    });
});

// The call Onshape's own insert dialog polls.
it("asks for a configured thumbnail where Onshape does", async () => {
    const api = fakeApi({});

    await getConfiguredThumbnail(
        api as unknown as OnshapeApi,
        WORKSPACE,
        "PNGGK3TH",
        "ec7326fdc70bed5fcf2d5275",
        ThumbnailSize.SMALL
    );

    expect(api.getImage).toHaveBeenCalledWith(
        `/thumbnails/d/ec194c001a419592e9fd55fd/w/c932796bcac2f7e7344a2072/e/8c8050a96ba6021887368f7a/c/PNGGK3TH/s/${ThumbnailSize.SMALL}`,
        { query: { t: "ec7326fdc70bed5fcf2d5275", rejectEmpty: "true" } }
    );
});
