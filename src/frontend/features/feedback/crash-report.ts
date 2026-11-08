import { useState } from "react";
import {
    FeedbackCategory,
    type FeedbackIn,
    type FeedbackOut,
    FeedbackSource,
    FeedbackTopic,
    MAX_FEEDBACK_TITLE
} from "@backend/features/feedback/contract";
import { ApiErrorKind } from "@backend/lib/api-error";
import { apiPost } from "../../lib/api-client";
import { AppError } from "../../lib/errors";
import { m } from "../../paraglide/messages";
import { collectDiagnostics, toReportedError } from "./diagnostics";

/** A crash is the app's, whichever page it hit. */
export const CRASH_TOPIC = FeedbackTopic.APP;

export enum CrashReportStatus {
    READY = "ready",
    SENDING = "sending",
    SENT = "sent",
    FAILED = "failed"
}

/** Names the Discord thread after the error, so crashes can be told apart at a glance. */
function crashTitle(error: unknown): string {
    const what =
        error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
    const title = m.appCrashedReportTitle({ error: what });
    return title.length <= MAX_FEEDBACK_TITLE
        ? title
        : title.slice(0, MAX_FEEDBACK_TITLE - 1) + "…";
}

export function crashReportBody(error: unknown): FeedbackIn {
    return {
        topic: CRASH_TOPIC,
        category: FeedbackCategory.BUG,
        source: FeedbackSource.ERROR,
        title: crashTitle(error),
        message: "",
        diagnostics: collectDiagnostics(toReportedError(m.appCrashed(), error))
    };
}

function failureMessage(cause: unknown): string {
    return cause instanceof AppError && cause.body.kind === ApiErrorKind.HANDLED
        ? cause.body.message
        : m.feedbackSendFailed();
}

interface CrashReport {
    status: CrashReportStatus;
    /** Why the last send failed, worded for the user. */
    failure?: string;
    send: () => void;
}

/**
 * Sends the crash straight to Discord, with no form. Plain state rather than a
 * mutation: the root's crash page has no query client above it.
 */
export function useCrashReport(error: unknown): CrashReport {
    const [status, setStatus] = useState(CrashReportStatus.READY);
    const [failure, setFailure] = useState<string>();

    const send = () => {
        setStatus(CrashReportStatus.SENDING);
        apiPost<FeedbackOut>("/feedback", {
            body: crashReportBody(error)
        }).then(
            () => setStatus(CrashReportStatus.SENT),
            (cause: unknown) => {
                setFailure(failureMessage(cause));
                setStatus(CrashReportStatus.FAILED);
            }
        );
    };

    return { status, failure, send };
}
