/** What Auto Assembly's routes take and answer. A leaf module: the client imports it. */
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
    /** Through every hole on the axis, gaps and all. */
    ALL_HOLES = "all-holes",
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
    /** Metres; the longest screw an automatic one may be, under either stop condition. Unlimited when absent. */
    maxLength?: number;
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

export interface AutoAssemblyIn {
    assembly: ElementPath;
    selectionMode: SelectionMode;
    /** Faces to fasten every hole in, or the holes' edges, by `selectionMode`. */
    targets: SelectedEntity[];
    /** The edges of holes in `targets` to leave out; faces only. */
    excluded: SelectedEntity[];
    /** Picks on library screws to take out, with their washers and nuts, and fasten again. */
    replaced: SelectedEntity[];
    options: FastenerOptions;
}

export enum HoleStatus {
    READY = "ready",
    /** A library screw is already in it. */
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
    /** The circular edge's occurrence path and edge id, joined. */
    key: string;
    status: HoleStatus;
    /** Why it can't be fastened, in words, when it can't. */
    reason?: string;
    end?: HoleEnd;
    /** Metres, from the circular edge to where the stack ends. */
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
export enum AssemblyTaskAction {
    INDEX = "index",
    /** Skipped when no screw to replace has a new plan. */
    REMOVE = "remove",
    INSERT = "insert",
    FASTEN = "fasten"
}

export enum AssemblyTaskState {
    PENDING = "pending",
    RUNNING = "running",
    DONE = "done",
    FAILED = "failed",
    /** Not tried, since an earlier step failed or left it nothing to do. */
    SKIPPED = "skipped"
}

export interface AssemblyTask {
    action: AssemblyTaskAction;
    state: AssemblyTaskState;
    /** Why it failed, written for the user. */
    reason?: string;
}

/** A run's steps, none started. */
export function pendingTasks(): AssemblyTask[] {
    return Object.values(AssemblyTaskAction).map((action) => ({
        action,
        state: AssemblyTaskState.PENDING
    }));
}

export enum AssemblyJobState {
    /** No run has been started in this assembly, or the last one aged out. */
    NONE = "none",
    RUNNING = "running",
    COMPLETE = "complete",
    FAILED = "failed"
}

/** What a run did: all of it, or as far as it got before it stopped. */
export interface AssemblyJobResult {
    /** Parts inserted. */
    inserted: number;
    /** Parts fastened to where they sit. */
    fastened: number;
    /** Screws taken out, with their washers and nuts, for new ones. */
    replaced: number;
}

export interface AssemblyJobStatus {
    state: AssemblyJobState;
    jobId?: string;
    tasks?: AssemblyTask[];
    /** Each hole picked, and what it got or why it got nothing, once indexed. */
    holes?: PlannedHole[];
    result?: AssemblyJobResult;
    /** Why the whole run stopped, when it did. Written for the user. */
    error?: string;
    /** When it ended, in epoch milliseconds. */
    finishedAt?: number;
}

export enum AssemblyJobOutcome {
    SUCCESS = "success",
    /** Some holes or parts weren't done, after something was. */
    PARTIAL = "partial",
    FAILED = "failed"
}

/** How a finished run went; undefined while there is nothing finished. */
export function assemblyJobOutcome(
    status: AssemblyJobStatus | undefined
): AssemblyJobOutcome | undefined {
    if (
        status?.state !== AssemblyJobState.COMPLETE &&
        status?.state !== AssemblyJobState.FAILED
    ) {
        return undefined;
    }
    const inserted = status.result?.inserted ?? 0;
    const anyFailed = (status.tasks ?? []).some(
        (task) => task.state === AssemblyTaskState.FAILED
    );
    const allReady = (status.holes ?? []).every(
        (hole) => hole.status !== HoleStatus.NO_FIT
    );
    const allFastened = (status.result?.fastened ?? 0) === inserted;
    if (
        status.state === AssemblyJobState.COMPLETE &&
        !anyFailed &&
        allReady &&
        allFastened
    ) {
        return AssemblyJobOutcome.SUCCESS;
    }
    return inserted > 0
        ? AssemblyJobOutcome.PARTIAL
        : AssemblyJobOutcome.FAILED;
}
