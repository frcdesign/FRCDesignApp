import { ApiErrorKind } from "@backend/lib/api-error";
import { type FeedbackDiagnostics } from "@backend/features/feedback/contract";
import { AppError } from "../../lib/errors";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { getUiState } from "../../lib/ui-state";

/** What went wrong, as a report carries it. */
export type ReportedError = NonNullable<FeedbackDiagnostics["error"]>;

/** `shown` is what the user read; the rest is what they may not have been shown. */
export function toReportedError(shown: string, error?: unknown): ReportedError {
    if (error instanceof AppError) {
        return {
            shown,
            kind: error.body.kind,
            // An internal message is for the logs, which is who reads a report.
            detail: error.body.message || undefined
        };
    }
    if (error instanceof Error) {
        return {
            shown,
            kind: ApiErrorKind.INTERNAL,
            detail: `${error.name}: ${error.message}`
        };
    }
    return { shown };
}

/** Read when the report is sent, so it describes the page it was sent from. */
export function collectDiagnostics(error?: ReportedError): FeedbackDiagnostics {
    const launch = useOnshapeLaunch.getState();
    return {
        url: window.location.href,
        build: import.meta.env.VITE_BUILD_ID,
        launch: {
            documentId: launch.documentId,
            instanceType: launch.instanceType,
            instanceId: launch.instanceId,
            elementId: launch.elementId,
            elementType: launch.elementType,
            sessionCompanyId: launch.sessionCompanyId,
            server: launch.server
        },
        viewedAccessLevel: getUiState().accessLevel,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        error
    };
}
