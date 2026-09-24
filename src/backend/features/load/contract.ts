/** Which of a library's groups are loading, so each can show that it is. */
export interface JobStatus {
    loadingGroupIds: string[];
}

export interface ReloadOut {
    /** How many documents were asked to reload. */
    documents: number;
}
