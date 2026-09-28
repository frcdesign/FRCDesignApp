/** Nothing private: a push says what changed, and the client refetches under its own access. */
import type { LibraryId } from "../library/library-id";
import type { JobStatus } from "../load/contract";
import type { ConfigurationKey } from "../configurations/contract";

export enum PushType {
    JOBS = "jobs",
    LIBRARY = "library",
    THUMBNAIL = "thumbnail"
}

/** A library's load jobs started or finished. */
export interface JobsPush {
    type: PushType.JOBS;
    libraryId: LibraryId;
    status: JobStatus;
}

/** A library's contents or admin team changed. */
export interface LibraryPush {
    type: PushType.LIBRARY;
    libraryId: LibraryId;
}

/** A configuration's thumbnail finished rendering. */
export interface ThumbnailPush {
    type: PushType.THUMBNAIL;
    elementId: string;
    microversionId: string;
    configurationKey: ConfigurationKey;
}

export type PushMessage = JobsPush | LibraryPush | ThumbnailPush;

/** Under `/api`. A client connects here naming the library it is showing. */
export const PUSH_ROUTE = "/push";
export const PUSH_LIBRARY_PARAM = "library";
