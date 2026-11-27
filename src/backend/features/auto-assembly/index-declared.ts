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
    type DeclaredProduct,
    findProducts,
    planDeclared
} from "./declared";
import { isScrewPlan, planScrews } from "./declared-screws";
import { DeclaredPartStatus } from "./contract";
import { getFastenerSet } from "./fastener-set";
import { indexHoles } from "./index-holes";
import { type Selection } from "../configurations/contract";
import { toSelection } from "../configurations/selection";
import {
    partName,
    readStoredParts,
    type StoredParts
} from "../library/insertables/part-name";
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
        connectors.flatMap(({ declaration }) => [
            declaration,
            ...(declaration.nut ? [declaration.nut] : [])
        ])
    );
    const plans = planDeclared(connectors, products, occurrences, choices);
    if (!plans.some(isScrewPlan)) {
        return plans;
    }
    const set = await getFastenerSet(db);
    if (!set) {
        return plans.map((plan) =>
            isScrewPlan(plan)
                ? {
                      connector: plan.connector,
                      status: DeclaredPartStatus.UNPLACEABLE,
                      reason: "FRCDesign's fasteners aren't loaded."
                  }
                : plan
        );
    }
    // Every Part Studio's holes, from the cache the prepare and checks fill
    const indexed = await indexHoles(client, kv, assembly, [], [], set);
    return nameParts(
        db,
        planScrews(plans, {
            catalog: set.catalog,
            holes: indexed.holes,
            placed: indexed.placed,
            products
        })
    );
}

/** Each planned screw and nut named as its studio's records name its configuration. */
async function nameParts(
    db: Db,
    plans: DeclaredPlan[]
): Promise<DeclaredPlan[]> {
    const stored = new Map<string, StoredParts | undefined>();
    const name = async (
        product: DeclaredProduct,
        configuration: Selection
    ): Promise<string | undefined> => {
        if (!stored.has(product.insertableId)) {
            stored.set(
                product.insertableId,
                await readStoredParts(db, product.insertableId)
            );
        }
        const parts = stored.get(product.insertableId);
        return parts
            ? partName(parts, toSelection(configuration, parts.parameters))
            : undefined;
    };
    return Promise.all(
        plans.map(async (plan) => {
            if (!isScrewPlan(plan) || !plan.product || !plan.configuration) {
                return plan;
            }
            const screwName = await name(plan.product, plan.configuration);
            const nutName =
                plan.nut &&
                (await name(plan.nut.product, plan.nut.configuration));
            return {
                ...plan,
                ...(screwName ? { name: screwName } : {}),
                ...(plan.nut && nutName
                    ? { nut: { ...plan.nut, name: nutName } }
                    : {})
            };
        })
    );
}
