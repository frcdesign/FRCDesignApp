/** A leaf the frontend imports. */

export enum StepExportState {
    ACTIVE = "active",
    DONE = "done",
    FAILED = "failed"
}

export interface StepExportOut {
    /** Onshape's translation id, which the status and file routes take. */
    translationId: string;
}

export interface StepExportStatus {
    state: StepExportState;
}

/** The file route, which the browser navigates to so it saves the response. */
export function stepExportFilePath(translationId: string): string {
    return `/api/step-export/${translationId}/file`;
}
