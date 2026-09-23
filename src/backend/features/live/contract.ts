/**
 * What the server pushes to open clients, so they need not poll for it. None
 * of it is private: it says that something changed, and a client that cares
 * asks the usual routes for what, under its own access.
 */
import type { LibraryId } from "../library/library-id";
import type { JobStatus } from "../load/contract";
import type { ConfigurationKey } from "../configurations/contract";

export enum LiveMessageType {
    /** A library's load jobs started or finished. */
    JOBS = "jobs",
    /** A library's contents changed under a new cache version. */
    LIBRARY = "library",
    /** A configuration's thumbnail finished rendering. */
    THUMBNAIL = "thumbnail",
    /** Who is on the admin team changed, so access may have. */
    ACCESS = "access"
}

export type LiveMessage =
    | { type: LiveMessageType.JOBS; libraryId: LibraryId; status: JobStatus }
    | { type: LiveMessageType.LIBRARY; libraryId: LibraryId }
    | {
          type: LiveMessageType.THUMBNAIL;
          elementId: string;
          microversionId: string;
          configurationKey: ConfigurationKey;
      }
    | { type: LiveMessageType.ACCESS };

/** Where a client connects, naming the library it is showing. */
export const LIVE_PATH = "/api/live";
export const LIVE_LIBRARY_PARAM = "library";
