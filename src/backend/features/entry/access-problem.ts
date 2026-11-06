/** Why `/init` sent a launch to `/document-access`. A leaf, so the page can read it. */
export enum AccessProblem {
    /** The grant is for another account than the document's, which only the caller can choose again. */
    OTHER_ACCOUNT = "other-account",
    /** The grant is the document's own account's, and still can't edit: the caller can only view it. */
    VIEW_ONLY = "view-only"
}

/** The search param it travels in. */
export const ACCESS_PROBLEM_PARAM = "problem";
