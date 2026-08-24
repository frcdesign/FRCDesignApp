/** What /api/bolt-helper takes and answers with. A leaf module the frontend imports. */

/** A circular edge the user picked, as Onshape's client messaging reports it. */
export interface EdgeSelection {
    /** Onshape's transient id for the edge, resolved with `qTransient`. */
    selectionId: string;
    /** The assembly instance the edge belongs to; empty at the top level. */
    occurrencePath: string[];
}

export interface BoltHelperResult {
    /** The tab the mates were added to. */
    elementName: string;
    /** One fasten mate per edge sent, in the same order. */
    featureIds: string[];
}
