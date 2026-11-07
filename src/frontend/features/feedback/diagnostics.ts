import { ApiErrorKind } from "@backend/lib/api-error";
import { type FeedbackDiagnostics } from "@backend/features/feedback/contract";
import { AppError } from "../../lib/errors";
import { PERSONAL_COMPANY_ID } from "@backend/features/auth/personal-company";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import {
    LAUNCH_KEYS,
    OnshapeLaunchType,
    toLaunchContext
} from "../../lib/onshape-launch";
import { getUiState } from "../../lib/ui-state";

/** What went wrong, as a report carries it. */
export type ReportedError = NonNullable<FeedbackDiagnostics["error"]>;

/** `shown` is what the user read; the rest is what they may not have been shown. */
export function toReportedError(shown: string, error?: unknown): ReportedError {
    if (error instanceof AppError) {
        const { request } = error;
        return {
            shown,
            kind: error.body.kind,
            // An internal message is for the logs, which is who reads a report.
            detail: error.body.message || undefined,
            request:
                request &&
                `${request.method} ${request.path} → ${request.status}`,
            errorId: error.body.errorId
        };
    }
    if (error instanceof Error) {
        return { shown, kind: ApiErrorKind.INTERNAL, detail: describe(error) };
    }
    return { shown };
}

/** With its stack, which still says where once minified; the build id says which bundle. */
function describe(error: Error): string {
    const summary = `${error.name}: ${error.message}`;
    if (!error.stack) return summary;
    // Chrome's stack starts with the summary; Firefox's and Safari's don't.
    return error.stack.startsWith(summary)
        ? error.stack
        : `${summary}\n${error.stack}`;
}

/** Onshape adds who launched the app and through which OAuth app; a report never says who. */
const IDENTITY_KEYS = ["userId", "clientId"];

/** The page without Onshape's launch params, which name the person, their document and company. */
function appPage(url: URL): string {
    const search = new URLSearchParams(url.search);
    for (const key of [...LAUNCH_KEYS, ...IDENTITY_KEYS]) {
        search.delete(key);
    }
    const query = search.toString();
    return url.pathname + (query ? `?${query}` : "");
}

/**
 * Read when the report is sent, so it describes the page it was sent from.
 * It describes the kind of tab the app was launched in, never which document.
 */
export function collectDiagnostics(error?: ReportedError): FeedbackDiagnostics {
    const url = new URL(window.location.href);
    // A page outside `/app`, like `/document-access`, has the launch only in its url.
    const launch = {
        ...Object.fromEntries(url.searchParams),
        ...useOnshapeLaunch.getState()
    };
    return {
        url: appPage(url),
        build: import.meta.env.VITE_BUILD_ID,
        launch: {
            elementType: launch.elementType,
            instanceType: launch.instanceType,
            enterprise:
                launch.sessionCompanyId !== undefined &&
                launch.sessionCompanyId !== PERSONAL_COMPANY_ID
        },
        launchContext: toLaunchContext(OnshapeLaunchType.parse(launch)),
        viewedAccessLevel: getUiState().accessLevel,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        error
    };
}
