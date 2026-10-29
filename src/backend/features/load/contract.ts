/** Which of a library's groups are loading, so each can show that it is. */
export interface JobStatus {
    loadingGroupIds: string[];
}

export interface ApproveVersionsOut {
    /** How many held documents were asked to reload. */
    documents: number;
}

export interface ReloadOut {
    /** How many documents were asked to reload. */
    documents: number;
}
