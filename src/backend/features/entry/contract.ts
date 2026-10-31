/** Why `/init` sent the caller to `/document-access`. A leaf, so the frontend can import it. */
export enum DocumentAccessProblem {
    /** Onshape's grant is for another account than the document's, so the app can't see it. */
    WRONG_ACCOUNT = "wrong-account",
    /** The caller can see the document but not edit it. */
    READ_ONLY = "read-only"
}

/** The search parameter `/document-access` reads the problem from. */
export const DOCUMENT_ACCESS_PROBLEM_PARAM = "problem";
