/**
 * What the app's panel and the FRCDesignApp Companion, the browser extension in
 * the Onshape page around it, post each other. A leaf, so the frontend and the
 * Companion can import it.
 */
import { type PreviewInstance } from "../previews/contract";

export const COMPANION_SOURCE = "frcdesign-companion";
export const COMPANION_PROTOCOL_VERSION = 1;

/** Origins the app is served from; the Companion ignores a message from anywhere else. */
export const APP_ORIGINS = [
    "https://app.frcdesign.org",
    "https://dev.frcdesign.org",
    "https://frc-design-app-cert.frcdesign-org.workers.dev"
];

/** What the panel posts to the Onshape page it's in. */
export type CompanionRequest =
    | { source: typeof COMPANION_SOURCE; type: "hello" }
    | {
          source: typeof COMPANION_SOURCE;
          type: "show-preview";
          /** Each mesh the parts name, as the app serves it, by id. */
          meshes: Record<string, ArrayBuffer>;
          parts: PreviewInstance[];
      }
    | { source: typeof COMPANION_SOURCE; type: "clear-preview" };

/** The Companion's answer to `hello`. */
export interface CompanionReady {
    source: typeof COMPANION_SOURCE;
    type: "ready";
    version: number;
}

const isTransform = (value: unknown): value is number[] =>
    Array.isArray(value) &&
    value.length === 16 &&
    value.every((entry) => Number.isFinite(entry));

function isInstance(
    value: unknown,
    meshes: Record<string, ArrayBuffer>
): value is PreviewInstance {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const { mesh, transform } = value as Record<string, unknown>;
    return (
        typeof mesh === "string" &&
        Object.hasOwn(meshes, mesh) &&
        isTransform(transform)
    );
}

function isMeshes(value: unknown): value is Record<string, ArrayBuffer> {
    return (
        typeof value === "object" &&
        value !== null &&
        Object.values(value).every((mesh) => mesh instanceof ArrayBuffer)
    );
}

export function parseCompanionRequest(
    data: unknown
): CompanionRequest | undefined {
    if (typeof data !== "object" || data === null) {
        return undefined;
    }
    const message = data as Record<string, unknown>;
    if (message.source !== COMPANION_SOURCE) {
        return undefined;
    }
    if (message.type === "hello" || message.type === "clear-preview") {
        return { source: COMPANION_SOURCE, type: message.type };
    }
    const { meshes, parts } = message;
    if (
        message.type === "show-preview" &&
        isMeshes(meshes) &&
        Array.isArray(parts) &&
        parts.every((part) => isInstance(part, meshes))
    ) {
        return {
            source: COMPANION_SOURCE,
            type: "show-preview",
            meshes,
            parts
        };
    }
    return undefined;
}

export function parseCompanionReady(data: unknown): CompanionReady | undefined {
    if (typeof data !== "object" || data === null) {
        return undefined;
    }
    const message = data as Record<string, unknown>;
    return message.source === COMPANION_SOURCE &&
        message.type === "ready" &&
        typeof message.version === "number"
        ? { source: COMPANION_SOURCE, type: "ready", version: message.version }
        : undefined;
}
