import { env } from "cloudflare:workers";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi
} from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import * as DocumentEndpoints from "../../lib/onshape/endpoints/documents";
import * as WebhookEndpoints from "../../lib/onshape/endpoints/webhooks";
import { QuantityType, Unit } from "./enums";

function mockUnits() {
    return vi.spyOn(DocumentEndpoints, "getUnitInfo").mockResolvedValue({
        defaultUnits: {
            units: [
                { key: QuantityType.ANGLE, value: Unit.DEGREE },
                { key: QuantityType.LENGTH, value: Unit.INCH }
            ]
        },
        unitsDisplayPrecision: { [Unit.DEGREE]: 1, [Unit.INCH]: 3 }
    });
}

const unitInfo = (instanceType: "w" | "v", documentId = "doc") =>
    createTestApp().request(
        `http://localhost/api/unit-info?documentId=${documentId}&instanceId=ws&instanceType=${instanceType}`,
        jsonRequest("GET"),
        env
    );

const deliver = (url: string, event: string) =>
    createTestApp().request(url, jsonRequest("POST", { event }), env);

describe("a workspace's units", () => {
    let watch: MockInstance<typeof WebhookEndpoints.createWebhook>;
    beforeEach(() => {
        watch = vi
            .spyOn(WebhookEndpoints, "createWebhook")
            .mockResolvedValue({ id: "hook", url: "", events: [] });
    });
    afterEach(() => vi.restoreAllMocks());

    it("asks Onshape once, then serves what it kept", async () => {
        const fetch = mockUnits();

        await unitInfo("w", "doc-once");
        const res = await unitInfo("w", "doc-once");

        expect(await res.json()).toMatchObject({ lengthUnit: Unit.INCH });
        expect(fetch).toHaveBeenCalledOnce();
    });

    it("watches a workspace with a transient webhook", async () => {
        mockUnits();

        await unitInfo("w", "doc-watch");

        expect(watch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                documentId: "doc-watch",
                workspaceId: "ws",
                events: ["onshape.model.lifecycle.updateworkspaceunits"],
                isTransient: true
            })
        );
    });

    // A version's units never change.
    it("watches nothing for a version", async () => {
        mockUnits();
        await unitInfo("v", "doc-version");
        expect(watch).not.toHaveBeenCalled();
    });

    it("asks again once the webhook says they changed", async () => {
        const fetch = mockUnits();
        await unitInfo("w", "doc-changed");
        const url = watch.mock.calls[0][1].url;

        await deliver(url, "onshape.model.lifecycle.updateworkspaceunits");
        await unitInfo("w", "doc-changed");

        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("keeps its copy through Onshape's registration check", async () => {
        const fetch = mockUnits();
        await unitInfo("w", "doc-register");
        const url = watch.mock.calls[0][1].url;

        expect((await deliver(url, "webhook.register")).status).toBe(200);
        await unitInfo("w", "doc-register");

        expect(fetch).toHaveBeenCalledOnce();
    });
});
