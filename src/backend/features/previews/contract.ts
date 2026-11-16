/**
 * Previews of parts in Onshape's graphics window: the mesh the app serves, and
 * the messages its panel posts to the preview extension. A leaf, so the
 * frontend and the extension can import it.
 */

/** Where one part of a preview goes, and the mesh it is drawn with. */
export interface PreviewPart {
    insertableId: string;
    /** The insertable's version the mesh is made from; pins the mesh's url. */
    microversionId: string;
    /** The selection's values, as `encodeConfiguration` writes them. */
    configuration: string;
    /** Into the open element, as Onshape writes a transform: 16 numbers, row-major, metres. */
    transform: number[];
}

/** One mesh per insertable, version and configuration. */
export function previewMeshId(part: PreviewPart): string {
    return `${part.insertableId}/${part.microversionId}/${part.configuration}`;
}

/**
 * A part's surface and its edges, in its Part Studio's coordinates, in metres.
 * Normals are per vertex.
 */
export interface PreviewMesh {
    positions: Float32Array;
    normals: Float32Array;
    /** Triangles, three indices each. */
    indices: Uint32Array;
    /** Edge segments, two points each, xyz. */
    edges: Float32Array;
}

const MAGIC = 0x4d504446; // "FDPM", little-endian
const FORMAT_VERSION = 1;
const HEADER_WORDS = 5;

export const PREVIEW_MESH_CONTENT_TYPE = "application/octet-stream";

/**
 * Little-endian: a header of five 32-bit words (magic, version, vertices,
 * indices, edge points), then positions, normals, indices and edge points,
 * each 4-byte aligned.
 */
export function encodePreviewMesh(mesh: PreviewMesh): ArrayBuffer {
    const vertexCount = mesh.positions.length / 3;
    const edgePointCount = mesh.edges.length / 3;
    const words =
        HEADER_WORDS +
        mesh.positions.length +
        mesh.normals.length +
        mesh.indices.length +
        mesh.edges.length;
    const buffer = new ArrayBuffer(words * 4);
    new Uint32Array(buffer, 0, HEADER_WORDS).set([
        MAGIC,
        FORMAT_VERSION,
        vertexCount,
        mesh.indices.length,
        edgePointCount
    ]);
    let offset = HEADER_WORDS * 4;
    for (const array of [
        mesh.positions,
        mesh.normals,
        mesh.indices,
        mesh.edges
    ]) {
        new Uint8Array(buffer, offset, array.byteLength).set(
            new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
        );
        offset += array.byteLength;
    }
    return buffer;
}

/** Undefined for anything this version doesn't write. */
export function decodePreviewMesh(
    buffer: ArrayBuffer
): PreviewMesh | undefined {
    if (buffer.byteLength < HEADER_WORDS * 4) {
        return undefined;
    }
    const [magic, version, vertexCount, indexCount, edgePointCount] =
        new Uint32Array(buffer, 0, HEADER_WORDS);
    const expected =
        (HEADER_WORDS + vertexCount * 6 + indexCount + edgePointCount * 3) * 4;
    if (
        magic !== MAGIC ||
        version !== FORMAT_VERSION ||
        buffer.byteLength !== expected ||
        indexCount % 3 !== 0
    ) {
        return undefined;
    }
    let offset = HEADER_WORDS * 4;
    const take = <T>(
        Kind: new (buffer: ArrayBuffer, offset: number, length: number) => T,
        length: number
    ): T => {
        const array = new Kind(buffer, offset, length);
        offset += length * 4;
        return array;
    };
    const mesh: PreviewMesh = {
        positions: take(Float32Array, vertexCount * 3),
        normals: take(Float32Array, vertexCount * 3),
        indices: take(Uint32Array, indexCount),
        edges: take(Float32Array, edgePointCount * 3)
    };
    return mesh.indices.every((index) => index < vertexCount)
        ? mesh
        : undefined;
}

export const PREVIEW_SOURCE = "frcdesign-preview";
export const PREVIEW_PROTOCOL_VERSION = 2;

/** Origins the app is served from; the extension ignores a message from anywhere else. */
export const APP_ORIGINS = [
    "https://app.frcdesign.org",
    "https://dev.frcdesign.org",
    "https://frc-design-app-cert.frcdesign-org.workers.dev"
];

/** A part to draw: a mesh the same message carries, placed by a transform. */
export interface PreviewInstance {
    mesh: string;
    /** Row-major, metres, as {@link PreviewPart.transform}. */
    transform: number[];
}

/** What the panel posts to the Onshape page it's in. */
export type PreviewRequest =
    | { source: typeof PREVIEW_SOURCE; type: "hello" }
    | {
          source: typeof PREVIEW_SOURCE;
          type: "show";
          /** Each mesh the parts name, as the app serves it, by id. */
          meshes: Record<string, ArrayBuffer>;
          parts: PreviewInstance[];
      }
    | { source: typeof PREVIEW_SOURCE; type: "clear" };

/** The extension's answer to `hello`. */
export interface PreviewReady {
    source: typeof PREVIEW_SOURCE;
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
    const { meshes, parts } = message;
    if (
        message.type === "show" &&
        isMeshes(meshes) &&
        Array.isArray(parts) &&
        parts.every((part) => isInstance(part, meshes))
    ) {
        return { source: PREVIEW_SOURCE, type: "show", meshes, parts };
    }
    return undefined;
}

export function parsePreviewReady(data: unknown): PreviewReady | undefined {
    if (typeof data !== "object" || data === null) {
        return undefined;
    }
    const message = data as Record<string, unknown>;
    return message.source === PREVIEW_SOURCE &&
        message.type === "ready" &&
        typeof message.version === "number"
        ? { source: PREVIEW_SOURCE, type: "ready", version: message.version }
        : undefined;
}
