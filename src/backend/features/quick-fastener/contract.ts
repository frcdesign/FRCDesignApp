/** What Quick fastener's routes take and answer. A leaf module: the client imports it. */
import { type ElementPath } from "../../lib/onshape/path";
import { type Program } from "./catalog";
import { type PartChoice, type ScrewChoice } from "./studios";

export enum FastenerMode {
    /** Long enough for each hole, from what it goes through. */
    AUTOMATIC = "automatic",
    /** One length, wherever it's put. */
    PRESET = "preset"
}

/** Where an automatic screw's stack ends. */
export enum StopCondition {
    /** Through every hole on the axis, gaps and all, up to the maximum length. */
    MAX_LENGTH = "max-length",
    /** At the first gap between parts wider than the maximum gap. */
    FIRST_GAP = "first-gap"
}

/** Inches, so the defaults read as the round numbers they are. */
export const DEFAULT_MAX_LENGTH = 3 * 0.0254;
export const DEFAULT_MAX_GAP = 0.03125 * 0.0254;
export const DEFAULT_MAX_THREAD_DEPTH = 0.5 * 0.0254;

export interface FastenerOptions {
    program: Program;
    mode: FastenerMode;
    /** Its length is the preset's, and automatic picks one in its place. */
    screw: ScrewChoice;
    /** Under the head; none when absent. */
    screwWasher?: PartChoice;
    /** Where the screw comes out the far side; none when absent. */
    nut?: PartChoice;
    /** Under the nut; only with one. */
    nutWasher?: PartChoice;
    stop: StopCondition;
    /** Metres; what `StopCondition.MAX_LENGTH` stops at. */
    maxLength: number;
    /** Metres; the widest gap `StopCondition.FIRST_GAP` reaches across. */
    maxGap: number;
    /** Metres; the farthest an automatic screw goes past where threads, or a blind hole, start. */
    maxThreadDepth: number;
}

/** What the picks are: faces to fasten every hole in, or the holes' own edges. */
export enum SelectionMode {
    FACES = "faces",
    LOCATIONS = "locations"
}

/** An edge or face picked in the assembly. */
export interface SelectedEntity {
    occurrencePath: string[];
    /** Its deterministic id in the Part Studio it's from. */
    entityId: string;
    entityType: SelectedEntityType;
}

export enum SelectedEntityType {
    EDGE = "EDGE",
    FACE = "FACE"
}

export interface QuickFastenerIn {
    assembly: ElementPath;
    selectionMode: SelectionMode;
    /** Faces to fasten every hole in, or the holes' edges, by `selectionMode`. */
    targets: SelectedEntity[];
    /** The edges of holes in `targets` to leave out; faces only. */
    excluded: SelectedEntity[];
    options: FastenerOptions;
}

export enum HoleStatus {
    READY = "ready",
    /** A Quick fastener screw is already in it. */
    FASTENED = "fastened",
    /** Nothing in the catalog fits, or reaches far enough within the maximum length. */
    NO_FIT = "no-fit"
}

/** How a fastener ends. */
export enum HoleEnd {
    /** Out the far side, where a nut goes. */
    THROUGH = "through",
    /** In threads. */
    TAPPED = "tapped",
    /** At the bottom of a hole without threads. */
    BLIND = "blind"
}

export interface PlannedHole {
    /** The circle's occurrence path and edge id, joined. */
    key: string;
    status: HoleStatus;
    /** Why it can't be fastened, in words, when it can't. */
    reason?: string;
    end?: HoleEnd;
    /** Metres, from the circle to where the stack ends. */
    depth?: number;
    screw?: ScrewChoice;
    screwWasher?: PartChoice;
    nut?: PartChoice;
    nutWasher?: PartChoice;
}

/** The assembly a run fastens in, as its status is keyed. */
export function assemblyKey(assembly: ElementPath): string {
    return `${assembly.documentId}|${assembly.instanceId}|${assembly.elementId}`;
}

/** The steps of a run, in the order it takes them. */
export enum FastenerTaskAction {
    INDEX = "index",
    INSERT = "insert",
    FASTEN = "fasten"
}

export enum FastenerTaskState {
    PENDING = "pending",
    RUNNING = "running",
    DONE = "done",
    FAILED = "failed",
    /** Not tried, since an earlier step failed or left it nothing to do. */
    SKIPPED = "skipped"
}

export interface FastenerTask {
    action: FastenerTaskAction;
    state: FastenerTaskState;
    /** Why it failed, written for the user. */
    reason?: string;
}

export enum FastenerJobState {
    /** No run has been started in this assembly, or the last one aged out. */
    NONE = "none",
    RUNNING = "running",
    COMPLETE = "complete",
    FAILED = "failed"
}

/** What a run did: all of it, or as far as it got before it stopped. */
export interface FastenerJobResult {
    /** Parts inserted. */
    inserted: number;
    /** Parts fastened to where they sit. */
    fastened: number;
}

export interface FastenerJobStatus {
    state: FastenerJobState;
    jobId?: string;
    tasks?: FastenerTask[];
    /** Each hole picked, and what it got or why it got nothing, once indexed. */
    holes?: PlannedHole[];
    result?: FastenerJobResult;
    /** Why the whole run stopped, when it did. Written for the user. */
    error?: string;
    /** When it ended, in epoch milliseconds. */
    finishedAt?: number;
}

export enum FastenerJobOutcome {
    SUCCESS = "success",
    /** Some holes or parts weren't done, after something was. */
    PARTIAL = "partial",
    FAILED = "failed"
}

/** How a finished run went; undefined while there is nothing finished. */
export function fastenerJobOutcome(
    status: FastenerJobStatus | undefined
): FastenerJobOutcome | undefined {
    if (
        status?.state !== FastenerJobState.COMPLETE &&
        status?.state !== FastenerJobState.FAILED
    ) {
        return undefined;
    }
    const inserted = status.result?.inserted ?? 0;
    const anyFailed = (status.tasks ?? []).some(
        (task) => task.state === FastenerTaskState.FAILED
    );
    const allReady = (status.holes ?? []).every(
        (hole) => hole.status !== HoleStatus.NO_FIT
    );
    const allFastened = (status.result?.fastened ?? 0) === inserted;
    if (
        status.state === FastenerJobState.COMPLETE &&
        !anyFailed &&
        allReady &&
        allFastened
    ) {
        return FastenerJobOutcome.SUCCESS;
    }
    return inserted > 0
        ? FastenerJobOutcome.PARTIAL
        : FastenerJobOutcome.FAILED;
}
