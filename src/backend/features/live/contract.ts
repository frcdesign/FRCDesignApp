/** Nothing private: a push says what changed, and the client refetches under its own access. */
import type { LibraryId } from "../library/library-id";
import type { JobStatus } from "../load/contract";
import type { ConfigurationKey } from "../configurations/contract";

export enum LiveMessageType {
    /** A library's load jobs started or finished. */
    JOBS = "jobs",
    /** Its contents or its admin team changed. */
    LIBRARY = "library",
    /** A configuration's thumbnail finished rendering. */
    THUMBNAIL = "thumbnail"
}

export type LiveMessage =
    | { type: LiveMessageType.JOBS; libraryId: LibraryId; status: JobStatus }
    | { type: LiveMessageType.LIBRARY; libraryId: LibraryId }
    | {
          type: LiveMessageType.THUMBNAIL;
          elementId: string;
          microversionId: string;
          configurationKey: ConfigurationKey;
      };

/** Where a client connects, naming the library it is showing. */
export const LIVE_PATH = "/api/live";
export const LIVE_LIBRARY_PARAM = "library";
