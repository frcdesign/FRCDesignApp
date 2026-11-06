/** Nothing private: a push says what changed, and the client refetches under its own access. */
import type { LibraryId } from "../library/library-id";
import type { JobStatus } from "../load/contract";
import type { ConfigurationKey } from "../configurations/contract";

export enum PushType {
    JOBS = "jobs",
    LIBRARY = "library",
    THUMBNAIL = "thumbnail",
    VERSION_JOB = "version-job",
    ASSEMBLY_JOB = "assembly-job"
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

/** A push or pull started from a workspace has moved on. */
export interface VersionJobPush {
    type: PushType.VERSION_JOB;
    workspaceKey: string;
}

/** An Auto Assembly run in an assembly has moved on; sent to everyone in its workspace. */
export interface AssemblyJobPush {
    type: PushType.ASSEMBLY_JOB;
    workspaceKey: string;
    /** The assembly, as `assemblyKey` spells it. */
    assemblyKey: string;
}

export type PushMessage =
    | JobsPush
    | LibraryPush
    | ThumbnailPush
    | VersionJobPush
    | AssemblyJobPush;

/** Under `/api`. A client connects here naming the library it is showing. */
export const PUSH_ROUTE = "/push";
export const PUSH_LIBRARY_PARAM = "library";
/** The workspace the client was launched in, as `workspaceKey` spells it. */
export const PUSH_WORKSPACE_PARAM = "workspace";
