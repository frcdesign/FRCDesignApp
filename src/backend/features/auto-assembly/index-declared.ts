/** Finds the parts FeatureScripts in an assembly declared: reads it, scans its Part Studios, and plans each part. */
import { type Db } from "../../db/client";
import { createLimiter } from "../../lib/limiter";
import { type OnshapeApi } from "../../lib/onshape/client";
import { type ElementPath } from "../../lib/onshape/path";
import { partOccurrences } from "./assembly";
import { readAssembly } from "./assembly-read";
import {
    assemblyConnectors,
    type DeclaredChoices,
    type DeclaredPlan,
    findProducts,
    planDeclared
} from "./declared";
import { scanDeclaredParts, type ScannedConnector } from "./part-scan";

/** Part Studios evaluated at once, as the hole scan's. */
const SCAN_CONCURRENCY = 6;

export async function indexDeclared(
    client: OnshapeApi,
    kv: KVNamespace,
    db: Db,
    assembly: ElementPath,
    choices: DeclaredChoices = {}
): Promise<DeclaredPlan[]> {
    const { definition, microversions } = await readAssembly(
        client,
        kv,
        assembly
    );
    const occurrences = partOccurrences(definition, assembly, microversions);
    const scanned = occurrences.filter(
        (occurrence) => !occurrence.isStandardContent
    );
    const sources = new Map(
        scanned.map((occurrence) => [occurrence.source.key, occurrence.source])
    );
    const limit = createLimiter(SCAN_CONCURRENCY);
    const scans = new Map<string, ScannedConnector[]>(
        await Promise.all(
            [...sources].map(
                async ([key, source]) =>
                    [
                        key,
                        await limit(() => scanDeclaredParts(client, kv, source))
                    ] as const
            )
        )
    );
    const connectors = assemblyConnectors(scanned, scans);
    const products = await findProducts(
        db,
        connectors.map((connector) => connector.declaration)
    );
    return planDeclared(connectors, products, occurrences, choices);
}
