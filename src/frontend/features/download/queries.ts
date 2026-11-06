import { useMutation } from "@tanstack/react-query";
import {
    StepExportState,
    stepExportFilePath,
    type StepExportOut,
    type StepExportStatus
} from "@backend/features/download/contract";
import { type InsertableOut } from "@backend/features/library/contract";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { apiGet, apiPost } from "../../lib/api-client";
import { appError, getAppErrorHandler } from "../../lib/errors";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { toInsertablePath } from "../../lib/api-paths";
import { m } from "../../paraglide/messages";

/** Onshape asks for polling with a backoff; most exports finish in seconds. */
const FIRST_POLL_MS = 1000;
const MAX_POLL_MS = 5000;
/** Past this the export is given up on, though Onshape may still finish it. */
const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves once Onshape has the file; throws once it fails or the wait runs out. */
async function waitForExport(
    translationId: string,
    name: string
): Promise<void> {
    const deadline = Date.now() + EXPORT_TIMEOUT_MS;
    let delay = FIRST_POLL_MS;
    while (Date.now() < deadline) {
        await wait(delay);
        const { state } = await apiGet<StepExportStatus>(
            `/step-export/${translationId}`
        );
        switch (state) {
            case StepExportState.DONE:
                return;
            case StepExportState.FAILED:
                throw appError(m.downloadStepOnshapeFailed({ name }));
            case StepExportState.ACTIVE:
                delay = Math.min(delay * 1.5, MAX_POLL_MS);
        }
    }
    throw appError(m.downloadStepTimedOut({ name }));
}

/** The route answers with an attachment, so the page stays where it is. */
function saveFile(path: string): void {
    const link = document.createElement("a");
    link.href = path;
    link.click();
}

export function useStepExportMutation(
    insertable: InsertableOut,
    /** Partial is fine: the server makes it whole. */
    selection: PartialSelection | undefined
) {
    const toastId = "step-export-" + insertable.id;
    const name = insertable.name;
    return useMutation({
        mutationKey: ["step-export", insertable.id],
        mutationFn: async () => {
            showLoadingToast(m.downloadStepExporting({ name }), toastId);
            const { translationId } = await apiPost<StepExportOut>(
                "/step-export" + toInsertablePath(insertable.id),
                { body: { selection } }
            );
            await waitForExport(translationId, name);
            saveFile(stepExportFilePath(translationId));
        },
        onError: getAppErrorHandler(m.downloadStepFailed({ name }), toastId),
        onSuccess: () =>
            showSuccessToast(m.downloadStepDownloaded({ name }), toastId)
    });
}
