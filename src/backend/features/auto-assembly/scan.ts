/**
 * The hole scan: `hole-scan.fs`'s `fastenerHoleScan`, evaluated in a Part
 * Studio, decoded, and cached by what it was evaluated at: a studio's holes,
 * and what each entity picked in it gave. A version, a document microversion
 * and a tab's microversion never change, so neither does a scan keyed by one:
 * nothing invalidates the cache, it only grows keys.
 */
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { internalError } from "../../lib/api-error";
import { kvStore, putQuietly } from "../../lib/kv-store";
import { type OnshapeApi } from "../../lib/onshape/client";
import { evaluateFeatureScript } from "../../lib/onshape/endpoints/part-studios";
import { type ElementPath } from "../../lib/onshape/path";
import { type OnshapeFeatureScriptValue } from "../../lib/onshape/types";
import HOLE_SCAN_SOURCE from "./hole-scan.fs?raw";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const holeSchema = z.object({
    faceId: z.string(),
    origin: vec3,
    direction: vec3,
    radius: z.number(),
    start: z.number(),
    end: z.number(),
    closedAtStart: z.boolean(),
    closedAtEnd: z.boolean(),
    threaded: z.boolean(),
    majorDiameter: z.number().optional(),
    countersunk: z.boolean().optional(),
    edges: z.array(z.object({ id: z.string(), at: z.number() }))
});

const circularEdgeSchema = z.object({
    id: z.string(),
    partId: z.string(),
    center: vec3,
    radius: z.number(),
    normal: vec3,
    faceId: z.string().optional()
});

const planeSchema = z.object({
    id: z.string(),
    partId: z.string(),
    origin: vec3,
    normal: vec3
});

const partsSchema = z.record(
    z.string(),
    z.object({ holes: z.array(holeSchema) })
);

const scanSchema = z.object({
    parts: partsSchema,
    // The scan's own key, from robot-code's FeatureScript.
    circles: z.array(circularEdgeSchema),
    planes: z.array(planeSchema).default([])
});

/** In the Part Studio's coordinates, in metres. */
export type ScannedHole = z.infer<typeof holeSchema>;
export type ScannedCircularEdge = z.infer<typeof circularEdgeSchema>;
export type ScannedPlane = z.infer<typeof planeSchema>;
export type ScannedParts = z.infer<typeof partsSchema>;
export type StudioScan = z.infer<typeof scanSchema>;

/** A Part Studio at one edit and configuration. */
export interface StudioSource {
    /** A version, a document microversion, or a workspace with `elementMicroversionId`. */
    path: ElementPath;
    configuration?: string;
    elementMicroversionId?: string;
    /** What pins it: the same key is always the same geometry. */
    key: string;
}

/** Entities picked in one Part Studio, by deterministic id. */
export interface StudioSelection {
    edges: string[];
    faces: string[];
    /** Planar faces to stop at. */
    planes: string[];
}

/** A month: a key is never stale, so this only bounds what's kept for studios nobody fastens to again. */
const SCAN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** The holes of a Part Studio's parts, by part id. */
export const holeScans = kvStore<ScannedParts>("auto-assembly-scan", {
    ttlSeconds: SCAN_TTL_SECONDS
});

/** What each entity picked in a studio gave, by its id; one that gave nothing has an empty list. */
interface PickScans {
    edges: Record<string, ScannedCircularEdge[]>;
    faces: Record<string, ScannedCircularEdge[]>;
    planes: Record<string, ScannedPlane[]>;
}

/** Per studio, so a pick is evaluated once however many are picked beside it. */
const pickScans = kvStore<PickScans>("auto-assembly-picks", {
    ttlSeconds: SCAN_TTL_SECONDS
});

/** Bumped when what a scan answers changes, so no cached scan is read in an older shape. */
const SCAN_VERSION = 2;

/** A scan's cache id: the scan's version and what pins the studio. */
function scanId(source: StudioSource): string {
    return `v${SCAN_VERSION}|${source.key}`;
}

/** Deterministic ids are letters, digits and a few marks; anything else can't reach the script. */
export const DETERMINISTIC_ID = /^[A-Za-z0-9_.+/-]+$/;

/**
 * A scan function's body, as the lambda Onshape's FeatureScript evaluation
 * takes: only std's common.fs is in scope there, so the function uses nothing
 * else and keeps its helpers inside it.
 */
export function scanLambda(source: string, name: string): string {
    const signature = new RegExp(
        `export function ${name}\\(context is Context, queries is map\\) returns map\\n\\{\\n([\\s\\S]*?)\\n\\}\\n`
    );
    const body = signature.exec(source)?.[1];
    if (body === undefined) {
        throw new Error(
            `The scan has no ${name}(context is Context, queries is map)`
        );
    }
    return `function(context is Context, queries is map)\n{\n${body}\n}`;
}

/** `fastenerHoleScan`'s body, as a lambda. */
export function holeScanLambda(source: string): string {
    return scanLambda(source, "fastenerHoleScan");
}

const HOLE_SCAN = holeScanLambda(HOLE_SCAN_SOURCE);

/** The scan, called with the picked entities as queries. */
export function scanScript(selection: StudioSelection): string {
    const query = (ids: string[]) =>
        `qUnion([${ids.map((id) => `qTransient(${JSON.stringify(id)})`).join(", ")}])`;
    const queries = [
        ...(selection.edges.length > 0
            ? [`"edges" : ${query(selection.edges)}`]
            : []),
        ...(selection.faces.length > 0
            ? [`"faces" : ${query(selection.faces)}`]
            : []),
        ...(selection.planes.length > 0
            ? [`"planes" : ${query(selection.planes)}`]
            : [])
    ];
    return `function(context is Context, queries is map)
{
    const scan = ${HOLE_SCAN};
    return scan(context, { ${queries.join(", ")} });
}`;
}

/** A FeatureScript value as plain JSON: maps become objects keyed by their keys' text. */
export function decodeFeatureScriptValue(
    value: OnshapeFeatureScriptValue | undefined
): unknown {
    if (!value) {
        return undefined;
    }
    // Onshape names the type either way: `BTFSValueMap-2062`, or `com.belmonttech.serialize.fsvalue.BTFSValueMap`
    const kind = value.btType.split("-")[0].split(".").at(-1);
    switch (kind) {
        case "BTFSValueMap": {
            const entries = (value.value ?? []) as {
                key: OnshapeFeatureScriptValue;
                value: OnshapeFeatureScriptValue;
            }[];
            return Object.fromEntries(
                entries.map((entry) => [
                    String(decodeFeatureScriptValue(entry.key)),
                    decodeFeatureScriptValue(entry.value)
                ])
            );
        }
        case "BTFSValueArray":
            return ((value.value ?? []) as OnshapeFeatureScriptValue[]).map(
                decodeFeatureScriptValue
            );
        case "BTFSValueUndefined":
            return undefined;
        default:
            return value.value;
    }
}

export function parseStudioScan(value: unknown): StudioScan {
    return scanSchema.parse(value);
}

function isSelectionEmpty(selection: StudioSelection): boolean {
    return (
        selection.edges.length === 0 &&
        selection.faces.length === 0 &&
        selection.planes.length === 0
    );
}

/** Those of the selection with no entry in `known`. */
function unscanned(
    selection: StudioSelection,
    known: PickScans
): StudioSelection {
    const isNew = (scanned: Record<string, unknown>) => (id: string) =>
        !Object.hasOwn(scanned, id);
    return {
        edges: selection.edges.filter(isNew(known.edges)),
        faces: selection.faces.filter(isNew(known.faces)),
        planes: selection.planes.filter(isNew(known.planes))
    };
}

/** `known`, with what a scan of `scanned` gave each of its entities. */
function withScanned(
    known: PickScans,
    scanned: StudioSelection,
    scan: StudioScan
): PickScans {
    const each = <T>(ids: string[], found: (id: string) => T[]) =>
        Object.fromEntries(ids.map((id) => [id, found(id)]));
    return {
        edges: {
            ...known.edges,
            ...each(scanned.edges, (id) =>
                scan.circles.filter(
                    (circle) => circle.id === id && circle.faceId === undefined
                )
            )
        },
        faces: {
            ...known.faces,
            ...each(scanned.faces, (id) =>
                scan.circles.filter((circle) => circle.faceId === id)
            )
        },
        planes: {
            ...known.planes,
            ...each(scanned.planes, (id) =>
                scan.planes.filter((plane) => plane.id === id)
            )
        }
    };
}

/** The scan of a selection, out of what each of its entities gave. */
function toStudioScan(
    parts: ScannedParts,
    picks: PickScans,
    selection: StudioSelection
): StudioScan {
    return {
        parts,
        circles: [
            ...selection.edges.flatMap((id) => picks.edges[id] ?? []),
            ...selection.faces.flatMap((id) => picks.faces[id] ?? [])
        ],
        planes: selection.planes.flatMap((id) => picks.planes[id] ?? [])
    };
}

async function evaluateScan(
    client: OnshapeApi,
    source: StudioSource,
    selection: StudioSelection
): Promise<StudioScan> {
    const response = await evaluateFeatureScript(
        client,
        source.path,
        scanScript(selection),
        {
            configuration: source.configuration,
            elementMicroversionId: source.elementMicroversionId
        }
    );
    if (!response.result) {
        const notices = (response.notices ?? [])
            .map((notice) => notice.message?.message)
            .filter(Boolean)
            .join("; ");
        throw internalError(
            `The hole scan failed: ${notices}`,
            HttpStatus.BAD_GATEWAY
        );
    }
    return parseStudioScan(decodeFeatureScriptValue(response.result));
}

/**
 * A studio's holes and what each pick in it gave, from the cache where this
 * edit of it was scanned before: only entities never scanned at it are
 * evaluated, and nothing is when the holes and every pick are cached.
 */
export async function scanStudio(
    client: OnshapeApi,
    kv: KVNamespace,
    source: StudioSource,
    selection: StudioSelection
): Promise<StudioScan> {
    const id = scanId(source);
    const [cachedParts, cachedPicks] = await Promise.all([
        holeScans.get(kv, id),
        isSelectionEmpty(selection) ? undefined : pickScans.get(kv, id)
    ]);
    const known = cachedPicks ?? { edges: {}, faces: {}, planes: {} };
    const missing = unscanned(selection, known);
    if (cachedParts && isSelectionEmpty(missing)) {
        return toStudioScan(cachedParts, known, selection);
    }
    const scan = await evaluateScan(client, source, missing);
    const found = withScanned(known, missing, scan);
    if (!cachedParts) {
        await putQuietly(holeScans, kv, id, scan.parts);
    }
    if (!isSelectionEmpty(missing)) {
        await putQuietly(pickScans, kv, id, found);
    }
    return toStudioScan(scan.parts, found, selection);
}
