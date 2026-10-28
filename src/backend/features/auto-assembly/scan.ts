/**
 * The hole scan: `hole-scan.fs`'s `fastenerHoleScan`, evaluated in a Part
 * Studio, decoded, and cached by what it was evaluated at. A version, a
 * document microversion and a tab's microversion never change, so neither does
 * a scan keyed by one: nothing invalidates the cache, it only grows keys.
 */
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { internalError } from "../../lib/api-error";
import { kvStore } from "../../lib/kv-store";
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

const partsSchema = z.record(
    z.string(),
    z.object({ holes: z.array(holeSchema) })
);

const scanSchema = z.object({
    parts: partsSchema,
    // The scan's own key, from robot-code's FeatureScript.
    circles: z.array(circularEdgeSchema)
});

/** In the Part Studio's coordinates, in metres. */
export type ScannedHole = z.infer<typeof holeSchema>;
export type ScannedCircularEdge = z.infer<typeof circularEdgeSchema>;
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
}

/** A month: a key is never stale, so this only bounds what's kept for studios nobody fastens to again. */
const SCAN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** The holes of a Part Studio's parts, by part id. */
export const holeScans = kvStore<ScannedParts>("auto-assembly-scan", {
    ttlSeconds: SCAN_TTL_SECONDS
});

/** Deterministic ids are letters, digits and a few marks; anything else can't reach the script. */
export const DETERMINISTIC_ID = /^[A-Za-z0-9_.+/-]+$/;

const SIGNATURE =
    /export function fastenerHoleScan\(context is Context, queries is map\) returns map\n\{\n([\s\S]*?)\n\}\n/;

/**
 * `fastenerHoleScan`'s body, as the lambda Onshape's FeatureScript evaluation
 * takes: only std's common.fs is in scope there, so the function uses nothing
 * else and keeps its helpers inside it.
 */
export function holeScanLambda(source: string): string {
    const body = SIGNATURE.exec(source)?.[1];
    if (body === undefined) {
        throw new Error(
            "hole-scan.fs has no fastenerHoleScan(context is Context, queries is map)"
        );
    }
    return `function(context is Context, queries is map)\n{\n${body}\n}`;
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
    return selection.edges.length === 0 && selection.faces.length === 0;
}

/**
 * A studio's holes, from the cache when nothing is picked in it; what's picked
 * is scanned every time, and the holes that scan finds are cached with it.
 */
export async function scanStudio(
    client: OnshapeApi,
    kv: KVNamespace,
    source: StudioSource,
    selection: StudioSelection
): Promise<StudioScan> {
    if (isSelectionEmpty(selection)) {
        const parts = await holeScans.get(kv, source.key);
        if (parts) {
            return { parts, circles: [] };
        }
    }
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
    const scan = parseStudioScan(decodeFeatureScriptValue(response.result));
    await holeScans.put(kv, source.key, scan.parts);
    return scan;
}
