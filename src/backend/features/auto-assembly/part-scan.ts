/**
 * The declared-part scan: `part-scan.fs`'s `declaredPartScan`, evaluated in a
 * Part Studio, decoded, and cached by what pins the studio, as the hole scan is.
 */
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { internalError } from "../../lib/api-error";
import { kvStore, putQuietly } from "../../lib/kv-store";
import { type OnshapeApi } from "../../lib/onshape/client";
import { evaluateFeatureScript } from "../../lib/onshape/endpoints/part-studios";
import {
    decodeFeatureScriptValue,
    scanLambda,
    type StudioSource
} from "./scan";
import PART_SCAN_SOURCE from "./part-scan.fs?raw";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const productSchema = z.object({
    documentId: z.string(),
    elementId: z.string(),
    configuration: z.record(z.string(), z.string()),
    name: z.string()
});

/** What robot-code's `autoAssemblyDeclaration` writes; version 1 is the only one so far. */
const declarationSchema = z.object({
    version: z.literal(1),
    kind: z.string(),
    documentId: z.string(),
    elementId: z.string(),
    configuration: z.record(z.string(), z.string()),
    name: z.string(),
    connector: z.string(),
    /** What the feature cut for the part: lengths in metres, enums by name. */
    spec: z
        .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
        .default({}),
    /** A screw's nut, where it comes out the far side of its holes. */
    nut: productSchema.optional()
});

const connectorSchema = z.object({
    partId: z.string(),
    connectorId: z.string(),
    origin: vec3,
    xAxis: vec3,
    zAxis: vec3,
    /** The far side of its hole, where a flipped part seats. */
    flip: z.object({ edgeId: z.string(), origin: vec3 }).optional(),
    declaration: declarationSchema
});

const declaredScanSchema = z.object({
    // A connector whose declaration this app can't read is left out, not the whole studio
    connectors: z.array(z.unknown()).transform((connectors) =>
        connectors.flatMap((each) => {
            const parsed = connectorSchema.safeParse(each);
            return parsed.success ? [parsed.data] : [];
        })
    )
});

/** robot-code's `AutoAssemblyKind`s this app knows. */
export enum DeclaredKind {
    MOTOR = "MOTOR",
    GEARBOX = "GEARBOX",
    BEARING = "BEARING",
    BUSHING = "BUSHING",
    BEARING_HAT = "BEARING_HAT",
    SCREW = "SCREW"
}

export type Declaration = z.infer<typeof declarationSchema>;
/** In the Part Studio's coordinates, in metres. */
export type ScannedConnector = z.infer<typeof connectorSchema>;

export function parseDeclaredScan(value: unknown): ScannedConnector[] {
    return declaredScanSchema.parse(value).connectors;
}

/** Bumped when what the scan answers changes, so no cached scan is read in an older shape. */
const DECLARED_SCAN_VERSION = 3;

/** A month, as the hole scan's: a key is never stale. */
const DECLARED_SCAN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** A Part Studio's declaring connectors. */
const declaredScans = kvStore<ScannedConnector[]>("auto-assembly-declared", {
    ttlSeconds: DECLARED_SCAN_TTL_SECONDS
});

export const DECLARED_SCAN = `function(context is Context, queries is map)
{
    const scan = ${scanLambda(PART_SCAN_SOURCE, "declaredPartScan")};
    return scan(context, {});
}`;

/** A studio's declaring connectors, from the cache where this edit of it was scanned before. */
export async function scanDeclaredParts(
    client: OnshapeApi,
    kv: KVNamespace,
    source: StudioSource
): Promise<ScannedConnector[]> {
    const id = `v${DECLARED_SCAN_VERSION}|${source.key}`;
    const cached = await declaredScans.get(kv, id);
    if (cached) {
        return cached;
    }
    const response = await evaluateFeatureScript(
        client,
        source.path,
        DECLARED_SCAN,
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
            `The part scan failed: ${notices}`,
            HttpStatus.BAD_GATEWAY
        );
    }
    const connectors = parseDeclaredScan(
        decodeFeatureScriptValue(response.result)
    );
    await putQuietly(declaredScans, kv, id, connectors);
    return connectors;
}
