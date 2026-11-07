import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiErrorKind } from "@backend/lib/api-error";

const toasts = vi.hoisted(() => ({
    renderNotification: vi.fn(
        (message: unknown, action?: { text: string; onClick: () => void }) => ({
            message,
            action
        })
    ),
    showErrorToast: vi.fn(() => "toast-id")
}));
vi.mock("./notifications", () => toasts);
const openErrorReport = vi.hoisted(() => vi.fn());
vi.mock("../features/feedback/open-feedback", () => ({ openErrorReport }));
vi.mock("@mantine/notifications", () => ({ notifications: { hide: vi.fn() } }));

const { AppError, handleAppError } = await import("./errors");
const { apiGet } = await import("./api-client");

/** The action the last toast offered. */
function lastAction() {
    const [body] = toasts.showErrorToast.mock.lastCall as unknown as [
        { action?: { text: string; onClick: () => void } }
    ];
    return body.action;
}

describe("handleAppError", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("offers a report of an internal error, carrying what the user wasn't shown", () => {
        handleAppError(
            new AppError({
                kind: ApiErrorKind.INTERNAL,
                message: "Onshape request failed: 500"
            }),
            "Failed to insert Bearing."
        );

        const action = lastAction()!;
        expect(action.text).toBe("Report");
        action.onClick();
        expect(openErrorReport).toHaveBeenCalledWith({
            shown: "Failed to insert Bearing.",
            kind: ApiErrorKind.INTERNAL,
            detail: "Onshape request failed: 500"
        });
    });

    it("reports which request failed and the server's id for it, without the query", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve(
                    Response.json(
                        {
                            kind: ApiErrorKind.INTERNAL,
                            message: "Internal Server Error",
                            errorId: "8f00ba11-IAD"
                        },
                        { status: 500 }
                    )
                )
            )
        );
        const error = await apiGet("/library-data/library/mkcad", {
            query: { documentId: "a-document" }
        }).then(
            () => new Error("The request succeeded."),
            (caught: Error) => caught
        );

        handleAppError(error, "Failed to load the library.");

        lastAction()!.onClick();
        expect(openErrorReport).toHaveBeenCalledWith({
            shown: "Failed to load the library.",
            kind: ApiErrorKind.INTERNAL,
            detail: "Internal Server Error",
            request: "GET /api/library-data/library/mkcad → 500",
            errorId: "8f00ba11-IAD"
        });
    });

    it("reports a handled error by the message the user read", () => {
        handleAppError(
            new AppError({
                kind: ApiErrorKind.HANDLED,
                message: "Rate limit."
            }),
            "Failed."
        );

        lastAction()!.onClick();
        expect(openErrorReport).toHaveBeenCalledWith(
            expect.objectContaining({ shown: "Rate limit." })
        );
    });

    it("offers sign-in, not a report, when the session is the problem", () => {
        handleAppError(
            new AppError({
                kind: ApiErrorKind.SIGN_IN_REQUIRED,
                message: "Sign in again."
            }),
            "Failed."
        );

        expect(lastAction()?.text).toBe("Sign in");
    });

    it("offers no report when told not to", () => {
        handleAppError(
            new Error("offline"),
            "Failed to send the report.",
            undefined,
            false
        );

        expect(toasts.showErrorToast).toHaveBeenLastCalledWith(
            "Failed to send the report.",
            undefined
        );
    });
});
