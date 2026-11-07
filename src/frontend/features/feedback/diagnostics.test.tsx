import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiErrorKind } from "@backend/lib/api-error";
import {
    FeedbackCategory,
    type FeedbackIn,
    FeedbackSource,
    FeedbackTopic
} from "@backend/features/feedback/contract";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { RootCrash } from "../../components/root-error";
import { collectDiagnostics } from "./diagnostics";

const DOCUMENT = "0123456789abcdef01234567";
const USER = "66f0ab4a55b9ff2109681766";

describe("collectDiagnostics", () => {
    afterEach(() => {
        useOnshapeLaunch.setState({}, true);
        window.history.replaceState(null, "", "/");
    });

    it("keeps the app's own page but not the document Onshape launched it in", () => {
        window.history.replaceState(
            null,
            "",
            `/app/library/frc-design-lib?documentId=${DOCUMENT}&instanceType=w&instanceId=${DOCUMENT}&elementId=${DOCUMENT}&elementType=ASSEMBLY&sessionCompanyId=${DOCUMENT}&server=https%3A%2F%2Fschool.onshape.com&userId=${USER}&clientId=client&insertable=ins`
        );

        const diagnostics = collectDiagnostics();

        expect(diagnostics.url).toBe(
            "/app/library/frc-design-lib?insertable=ins"
        );
        expect(diagnostics.launch).toEqual({
            elementType: "ASSEMBLY",
            instanceType: "w",
            enterprise: true
        });
        expect(JSON.stringify(diagnostics)).not.toContain(DOCUMENT);
        expect(JSON.stringify(diagnostics)).not.toContain("school");
        expect(JSON.stringify(diagnostics)).not.toContain(USER);
    });

    it("reads a personal account as no Enterprise", () => {
        useOnshapeLaunch.setState({
            documentId: DOCUMENT,
            sessionCompanyId: "cad",
            elementType: undefined
        });

        expect(collectDiagnostics().launch?.enterprise).toBe(false);
    });
});

describe("RootCrash", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        window.history.replaceState(null, "", "/");
    });

    function answer(status: number, body: unknown) {
        return vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(Response.json(body, { status }));
    }

    it("sends the crash with its stack in one click, with nothing typed", async () => {
        const user = userEvent.setup();
        const fetch = answer(200, { reportId: "r" });
        window.history.replaceState(null, "", "/dashboard?range=7d");
        const error = new TypeError("boom");
        render(<RootCrash error={error} />);

        expect(screen.getByText("Please send a report.")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Send report" }));

        expect(await screen.findByText(/Report sent!/)).toBeTruthy();
        const [url, init] = fetch.mock.calls[0];
        expect(url as string).toMatch(/^\/api\/feedback/);
        const body = JSON.parse(init?.body as string) as FeedbackIn;
        expect(body).toMatchObject({
            topic: FeedbackTopic.APP,
            category: FeedbackCategory.BUG,
            source: FeedbackSource.ERROR,
            title: "Crash: TypeError: boom",
            message: ""
        });
        expect(body.diagnostics.url).toBe("/dashboard?range=7d");
        expect(body.diagnostics.error?.shown).toBe(
            "The app has crashed due to an unexpected error."
        );
        expect(body.diagnostics.error?.detail).toContain(error.stack);
        expect(
            screen.queryByRole("button", { name: "Send report" })
        ).toBeNull();
    });

    it("says why a send failed and lets it be sent again", async () => {
        const user = userEvent.setup();
        const message =
            "You've sent a lot of reports recently. Please try again in an hour.";
        const fetch = answer(429, { kind: ApiErrorKind.HANDLED, message });
        render(<RootCrash error={new Error("boom")} />);

        await user.click(screen.getByRole("button", { name: "Send report" }));
        expect(await screen.findByText(message)).toBeTruthy();

        fetch.mockResolvedValue(Response.json({ reportId: "r" }));
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText(/Report sent!/)).toBeTruthy();
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
