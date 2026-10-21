/** What Quick fastener's routes take and answer. A leaf module: the client imports it. */
import { type ElementPath } from "../../lib/onshape/path";
import {
    type NutChoice,
    type Program,
    type ScrewChoice,
    type WasherChoice
} from "./catalog";

export enum FastenerMode {
    /** Sized and long enough for each hole, from what it goes through. */
    AUTOMATIC = "automatic",
    /** One size and length, wherever it's put. */
    PRESET = "preset"
}

/** Inches, so the default reads as the round number it is. */
export const DEFAULT_MAX_LENGTH = 3 * 0.0254;

export interface FastenerOptions {
    program: Program;
    mode: FastenerMode;
    vendor: string;
    head: string;
    /** Preset only. */
    size?: string;
    /** Preset only: a length the vendor makes `size` and `head` in. */
    length?: string;
    /** A washer under each head. */
    headWasher: boolean;
    /** No nuts when absent. Automatic places one only where the screw comes out the far side. */
    nutType?: string;
    /** A washer under each nut. */
    nutWasher: boolean;
    /** Metres. */
    maxLength: number;
    /** Stops at the first gap between parts rather than bridging it. */
    upToNext: boolean;
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
    /** Circles to fasten, and faces whose circles to. */
    targets: SelectedEntity[];
    /** Circles to leave out, and faces whose circles to. */
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
    headWasher?: WasherChoice;
    nutWasher?: WasherChoice;
    nut?: NutChoice;
}

export interface QuickFastenerPlan {
    holes: PlannedHole[];
}

export interface QuickFastenerInsertOut {
    inserted: number;
}
