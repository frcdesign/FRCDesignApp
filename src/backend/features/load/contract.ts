/** Which of a library's groups are loading, so each can show that it is. */
export interface JobStatus {
    loadingGroupIds: string[];
    /** Holding a new version until an admin approves it. */
    awaitingApprovalGroupIds: string[];
}

export interface VersionApprovalOut {
    /** Whether new versions wait for an admin's approval before loading. */
    enabled: boolean;
}

export interface ApproveVersionsOut {
    /** How many documents were let through. */
    documents: number;
}

export interface ReloadOut {
    /** How many documents were asked to reload. */
    documents: number;
}
