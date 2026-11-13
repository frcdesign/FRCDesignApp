/** What the app's panel posts to the extension, and what it answers. A leaf, so the frontend can import it. */

export const PREVIEW_SOURCE = "frcdesign-preview";
export const PROTOCOL_VERSION = 1;

/** Origins the app is served from; a message from anywhere else is ignored. */
export const APP_ORIGINS = [
    "https://app.frcdesign.org",
    "https://dev.frcdesign.org",
    "https://frc-design-app-cert.frcdesign-org.workers.dev"
];

/**
 * Lengths are metres. Each shape sits on its seat at the origin with its axis
 * along +Z: a screw's head above and shank below, a nut and a washer above.
 */
export type PreviewShape = ScrewShape | NutShape | WasherShape;

export interface ScrewShape {
    kind: "screw";
    diameter: number;
    /** Under the head, or overall for a countersunk head. */
    length: number;
    headDiameter: number;
    headHeight: number;
    /** A countersunk head sits below the seat, flush with it. */
    isCountersunk?: boolean;
}

export interface NutShape {
    kind: "nut";
    acrossFlats: number;
    height: number;
}

export interface WasherShape {
    kind: "washer";
    innerDiameter: number;
    outerDiameter: number;
    thickness: number;
}

export interface PreviewPart {
    shape: PreviewShape;
    /** Where it goes in the open element, as Onshape's API writes a transform: 16 numbers, row-major, metres. */
    transform: number[];
}

export type PreviewRequest =
    | { source: typeof PREVIEW_SOURCE; type: "hello" }
    | { source: typeof PREVIEW_SOURCE; type: "show"; parts: PreviewPart[] }
    | { source: typeof PREVIEW_SOURCE; type: "clear" };

export interface PreviewReady {
    source: typeof PREVIEW_SOURCE;
    type: "ready";
    version: number;
}

const isLength = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;

function isShape(value: unknown): value is PreviewShape {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const shape = value as Record<string, unknown>;
    switch (shape.kind) {
        case "screw":
            return (
                isLength(shape.diameter) &&
                isLength(shape.length) &&
                isLength(shape.headDiameter) &&
                isLength(shape.headHeight)
            );
        case "nut":
            return isLength(shape.acrossFlats) && isLength(shape.height);
        case "washer":
            return (
                isLength(shape.innerDiameter) &&
                isLength(shape.outerDiameter) &&
                isLength(shape.thickness)
            );
        default:
            return false;
    }
}

function isPart(value: unknown): value is PreviewPart {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const { shape, transform } = value as Record<string, unknown>;
    return (
        isShape(shape) &&
        Array.isArray(transform) &&
        transform.length === 16 &&
        transform.every((entry) => Number.isFinite(entry))
    );
}

export function parsePreviewRequest(data: unknown): PreviewRequest | undefined {
    if (typeof data !== "object" || data === null) {
        return undefined;
    }
    const message = data as Record<string, unknown>;
    if (message.source !== PREVIEW_SOURCE) {
        return undefined;
    }
    if (message.type === "hello" || message.type === "clear") {
        return { source: PREVIEW_SOURCE, type: message.type };
    }
    if (
        message.type === "show" &&
        Array.isArray(message.parts) &&
        message.parts.every(isPart)
    ) {
        return { source: PREVIEW_SOURCE, type: "show", parts: message.parts };
    }
    return undefined;
}
