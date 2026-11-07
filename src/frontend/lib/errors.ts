import { ApiErrorKind, type ApiErrorBody } from "@backend/lib/api-error";
import { notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { renderNotification, showErrorToast } from "./notifications";
import { startSignIn } from "../features/auth/sign-in";
import { toReportedError } from "../features/feedback/diagnostics";
import { openErrorReport } from "../features/feedback/open-feedback";
import { m } from "../paraglide/messages";

/** An `/api` call that failed, as a report names it. */
export interface FailedRequest {
    method: string;
    /** Without the query, which can name the user's document. */
    path: string;
    status: number;
}

/** `body` is the discriminated shape the backend sends; `request` is set when it came from one. */
export class AppError extends Error {
    constructor(
        readonly body: ApiErrorBody,
        readonly request?: FailedRequest
    ) {
        super(body.message);
        this.name = "AppError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** The status is all an image route can say, and it tells "still rendering" from "can't render". */
export class ImageLoadError extends Error {
    constructor(readonly status: number) {
        super(`Image request failed with ${status}.`);
        this.name = "ImageLoadError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Raised on the client, with wording already written for the user. */
export function appError(message: string): AppError {
    return new AppError({ kind: ApiErrorKind.HANDLED, message });
}

/** The kinds whose message was written for the user to read. */
const SPOKEN_KINDS: ApiErrorBody["kind"][] = [
    ApiErrorKind.HANDLED,
    ApiErrorKind.SIGN_IN_REQUIRED,
    ApiErrorKind.FORBIDDEN
];

/** Builds an {@link AppError} from a failed /api response body. */
export function fromApiErrorBody(
    body: unknown,
    request?: FailedRequest
): AppError {
    const parsed = body as Partial<ApiErrorBody> | undefined;
    const kind = SPOKEN_KINDS.find((spoken) => spoken === parsed?.kind);
    // Anything unrecognized is a failure we did not write wording for.
    return new AppError(
        {
            kind: kind ?? ApiErrorKind.INTERNAL,
            message: parsed?.message ?? "",
            errorId:
                typeof parsed?.errorId === "string" ? parsed.errorId : undefined
        },
        request
    );
}

export function getAppErrorHandler(defaultMessage: string, toastId?: string) {
    return (error: Error) => handleAppError(error, defaultMessage, toastId);
}

/** Long enough to reach the Report button before the toast goes. */
const REPORTABLE_AUTO_CLOSE_MS = 8000;

/** An error toast with a Report button, which carries `error` into the report. */
export function showReportableErrorToast(
    message: string,
    error?: unknown,
    toastKey?: string
): void {
    const body: ReactNode = renderNotification(message, {
        text: m.feedbackToastReport(),
        // Clicked only once the toast is up, so `id` is set by then.
        onClick: () => {
            notifications.hide(id);
            openErrorReport(toReportedError(message, error));
        }
    });
    const id = showErrorToast(body, toastKey, {
        autoClose: REPORTABLE_AUTO_CLOSE_MS
    });
}

/**
 * Only messages worded for the user are shown; anything else gets
 * `defaultMessage`. Each offers a report, unless `reportable` is false.
 */
export function handleAppError(
    error: Error,
    defaultMessage: string,
    toastKey?: string,
    reportable = true
) {
    let message = defaultMessage;
    if (error instanceof AppError) {
        switch (error.body.kind) {
            case ApiErrorKind.SIGN_IN_REQUIRED:
                showErrorToast(
                    renderNotification(error.body.message, {
                        text: "Sign in",
                        onClick: startSignIn
                    }),
                    toastKey
                );
                return;
            case ApiErrorKind.HANDLED:
            case ApiErrorKind.FORBIDDEN:
                message = error.body.message;
                break;
            case ApiErrorKind.INTERNAL:
                break;
        }
    }
    if (reportable) {
        showReportableErrorToast(message, error, toastKey);
    } else {
        showErrorToast(message, toastKey);
    }
}
