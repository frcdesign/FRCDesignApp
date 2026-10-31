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
