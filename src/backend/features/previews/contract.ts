/**
 * Previews of parts in Onshape's graphics window: what a part's preview is
 * made of, and the mesh the app serves for it. A leaf, so the frontend and the
 * Companion can import it.
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

/** A part to draw: a mesh the same message carries, placed by a transform. */
export interface PreviewInstance {
    mesh: string;
    /** Row-major, metres, as {@link PreviewPart.transform}. */
    transform: number[];
}
