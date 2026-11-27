/**
 * Parts robot-code's FeatureScripts declared, as a run places them: each
 * declaring connector moved into the assembly, its library Part Studio found
 * among the loaded insertables, and the Onshape bodies that insert and fasten
 * the part on it.
 */
import { and, desc, eq, or } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import { ElementType } from "../../lib/onshape/element-type";
import { PartType } from "../../lib/onshape/endpoints/documents";
import {
    fastenMate,
    fastenMateToCircularEdge,
    partStudioMateConnectorQuery
} from "../../lib/onshape/objects/assembly-features";
import { type LibraryId } from "../library/library-id";
import { MateLocation } from "../library/insertables/fasten";
import {
    type ConfigurationParameter,
    ParameterType,
    type Selection
} from "../configurations/contract";
import {
    partStudioInsertOverrides,
    toSelection
} from "../configurations/selection";
import { encodeConfiguration } from "../configurations/utils";
import { type PartOccurrence, pathKey } from "./assembly";
import { DeclaredPartStatus, type DeclaredPart } from "./contract";
import {
    coordinateTransform,
    LINEAR_TOLERANCE,
    norm,
    scale,
    subtract,
    transformDirection,
    transformPoint,
    type Vec3
} from "./geometry";
import {
    type Declaration,
    DeclaredKind,
    type ScannedConnector
} from "./part-scan";

/** A declaring connector in the assembly. */
export interface AssemblyConnector {
    /** The host's occurrence path and the connector's id, joined. */
    key: string;
    hostPath: string[];
    connectorId: string;
    origin: Vec3;
    xAxis: Vec3;
    zAxis: Vec3;
    /** The far side of its hole, in the assembly. */
    flip?: { edgeId: string; origin: Vec3 };
    declaration: Declaration;
}

/** Each occurrence's declaring connectors, in the assembly's coordinates. */
export function assemblyConnectors(
    occurrences: PartOccurrence[],
    scans: Map<string, ScannedConnector[]>
): AssemblyConnector[] {
    return occurrences.flatMap((occurrence) =>
        (scans.get(occurrence.source.key) ?? [])
            .filter((connector) => connector.partId === occurrence.partId)
            .map((connector) => ({
                key: `${pathKey(occurrence.path)}|${connector.connectorId}`,
                hostPath: occurrence.path,
                connectorId: connector.connectorId,
                origin: transformPoint(occurrence.transform, connector.origin),
                xAxis: transformDirection(
                    occurrence.transform,
                    connector.xAxis
                ),
                zAxis: transformDirection(
                    occurrence.transform,
                    connector.zAxis
                ),
                ...(connector.flip
                    ? {
                          flip: {
                              edgeId: connector.flip.edgeId,
                              origin: transformPoint(
                                  occurrence.transform,
                                  connector.flip.origin
                              )
                          }
                      }
                    : {}),
                declaration: connector.declaration
            }))
    );
}

/** A declaration's Part Studio, as the library loaded it last. */
export interface DeclaredProduct {
    insertableId: string;
    libraryId: LibraryId;
    documentId: string;
    versionId: string;
    elementId: string;
    elementType: ElementType;
    parameters: ConfigurationParameter[];
    /** The connector a fasten mate names on it; absent when the load found none. */
    mateConnectorId?: string;
}

/** `{documentId}|{elementId}`, as declarations and insertables are matched. */
export function productKey(product: {
    documentId: string;
    elementId: string;
}): string {
    return `${product.documentId}|${product.elementId}`;
}

/** The declarations' products the library has, by `productKey`: of a tab loaded more than once, the latest load. */
export async function findProducts(
    db: Db,
    declarations: Declaration[]
): Promise<Map<string, DeclaredProduct>> {
    const wanted = new Map(
        declarations.map((declaration) => [
            productKey(declaration),
            declaration
        ])
    );
    if (wanted.size === 0) {
        return new Map();
    }
    const rows = await db
        .select({
            insertableId: insertables.id,
            libraryId: insertables.libraryId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            elementType: insertables.elementType,
            fastenInfo: insertables.fastenInfo,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(
            or(
                ...[...wanted.values()].map((declaration) =>
                    and(
                        eq(insertables.documentId, declaration.documentId),
                        eq(insertables.elementId, declaration.elementId)
                    )
                )
            )
        )
        .orderBy(desc(insertables.lastLoadedAt));
    const products = new Map<string, DeclaredProduct>();
    for (const row of rows) {
        const key = productKey(row);
        if (products.has(key) || !row.libraryId) {
            continue;
        }
        const fasten = row.fastenInfo;
        products.set(key, {
            insertableId: row.insertableId,
            libraryId: row.libraryId,
            documentId: row.documentId,
            versionId: row.versionId,
            elementId: row.elementId,
            elementType: row.elementType,
            parameters: row.parameters ?? [],
            // A Part Studio's own connector; one inside an assembly needs a path this doesn't place
            ...(fasten?.mateLocation === MateLocation.Feature
                ? { mateConnectorId: fasten.mateConnectorId }
                : {})
        });
    }
    return products;
}

/** A declared part as a run places it: where, from which product, configured how; or why it isn't. */
export interface DeclaredPlan {
    connector: AssemblyConnector;
    status: DeclaredPartStatus;
    reason?: string;
    /** Seated on the far side of its hole. */
    isFlipped?: boolean;
    product?: DeclaredProduct;
    /** The Part Studio's overrides, as inserted. */
    configuration?: Selection;
}

/** Each option the declaration names is one its studio offers. */
function isOffered(
    configuration: Record<string, string>,
    parameters: ConfigurationParameter[]
): boolean {
    return Object.entries(configuration).every(([id, value]) => {
        const parameter = parameters.find((each) => each.id === id);
        if (!parameter) {
            return false;
        }
        return (
            parameter.type !== ParameterType.ENUM ||
            parameter.options.some((option) => option.id === value)
        );
    });
}

/** A part of the product with its origin on either side of the connector's hole, as a run inserts it. */
function isPlaced(
    connector: AssemblyConnector,
    occurrences: PartOccurrence[]
): boolean {
    const seats = [
        connector.origin,
        ...(connector.flip ? [connector.flip.origin] : [])
    ];
    return occurrences.some((occurrence) => {
        if (productKey(occurrence) !== productKey(connector.declaration)) {
            return false;
        }
        const origin = transformPoint(occurrence.transform, [0, 0, 0]);
        return seats.some(
            (seat) => norm(subtract(origin, seat)) < LINEAR_TOLERANCE
        );
    });
}

/** Which parts a run places, and which flipped; every part, none flipped, by default. */
export interface DeclaredChoices {
    parts?: string[];
    flipped?: string[];
}

/** Why a declaration can't be placed; undefined when it can. */
function unplaceable(
    declaration: Declaration,
    product: DeclaredProduct | undefined
): string | undefined {
    if (!product) {
        return "FRCDesign's library doesn't have this part.";
    }
    if (product.elementType !== ElementType.PART_STUDIO) {
        return "Only Part Studios can be placed.";
    }
    if (!product.mateConnectorId) {
        return "This part has no mate connector.";
    }
    if (!isOffered(declaration.configuration, product.parameters)) {
        return "This part's configuration isn't in the library.";
    }
    // A screw sized by what its hole goes through is for the hole planner
    if (
        declaration.kind === DeclaredKind.SCREW &&
        declaration.configuration.length === undefined
    ) {
        return "Screws of automatic length aren't placed yet.";
    }
    return undefined;
}

/** Each is a step of its own to fasten; a run again places the rest. */
export const MAX_DECLARED_PARTS = 200;

/** What each connector gets: a part, one already there, or why neither. */
export function planDeclared(
    connectors: AssemblyConnector[],
    products: Map<string, DeclaredProduct>,
    occurrences: PartOccurrence[],
    choices: DeclaredChoices = {}
): DeclaredPlan[] {
    const chosen = choices.parts && new Set(choices.parts);
    const flipped = new Set(choices.flipped ?? []);
    let ready = 0;
    const planned = chosen
        ? connectors.filter((connector) => chosen.has(connector.key))
        : connectors;
    return planned.map((connector): DeclaredPlan => {
        const { declaration } = connector;
        const product = products.get(productKey(declaration));
        const reason = unplaceable(declaration, product);
        if (reason || !product) {
            return {
                connector,
                status: DeclaredPartStatus.UNPLACEABLE,
                reason
            };
        }
        if (isPlaced(connector, occurrences)) {
            return { connector, status: DeclaredPartStatus.PLACED, product };
        }
        if (++ready > MAX_DECLARED_PARTS) {
            return {
                connector,
                status: DeclaredPartStatus.UNPLACEABLE,
                reason: "Too many parts for one run. Run it again for the rest."
            };
        }
        return {
            connector,
            status: DeclaredPartStatus.READY,
            ...(flipped.has(connector.key) && connector.flip
                ? { isFlipped: true }
                : {}),
            product,
            configuration: partStudioInsertOverrides(
                toSelection(declaration.configuration, product.parameters),
                product.parameters
            )
        };
    });
}

/** What a run reports of each plan. */
export function declaredPart(plan: DeclaredPlan): DeclaredPart {
    return {
        key: plan.connector.key,
        name: plan.connector.declaration.name,
        status: plan.status,
        ...(plan.reason ? { reason: plan.reason } : {}),
        hostPath: plan.connector.hostPath,
        canFlip: plan.connector.flip !== undefined,
        ...(plan.isFlipped ? { isFlipped: true } : {})
    };
}

/** `transformedinstances`' groups: each ready part, its origin on its connector. */
export function declaredInsertGroups(
    plans: DeclaredPlan[]
): { instances: object[]; transform: number[] }[] {
    return plans.flatMap((plan) => {
        const { product, connector } = plan;
        if (plan.status !== DeclaredPartStatus.READY || !product) {
            return [];
        }
        return [
            {
                instances: [
                    {
                        documentId: product.documentId,
                        versionId: product.versionId,
                        elementId: product.elementId,
                        configuration: encodeConfiguration(plan.configuration),
                        isWholePartStudio: true,
                        includePartTypes: [PartType.PARTS]
                    }
                ],
                transform:
                    plan.isFlipped && connector.flip
                        ? coordinateTransform(
                              connector.flip.origin,
                              connector.xAxis,
                              scale(connector.zAxis, -1)
                          )
                        : coordinateTransform(
                              connector.origin,
                              connector.xAxis,
                              connector.zAxis
                          )
            }
        ];
    });
}

/**
 * The fasten mate holding an inserted part on its connector, the host second
 * so it stays put. A flipped part is fastened to the far rim's implicit
 * connector, which points out of the far face.
 */
export function declaredMate(plan: DeclaredPlan, path: string[]): object {
    const { connector } = plan;
    const own = partStudioMateConnectorQuery(
        plan.product?.mateConnectorId ?? "",
        path
    );
    if (plan.isFlipped && connector.flip) {
        return fastenMateToCircularEdge(connector.declaration.name, own, {
            deterministicId: connector.flip.edgeId,
            path: connector.hostPath
        });
    }
    return fastenMate(connector.declaration.name, [
        own,
        partStudioMateConnectorQuery(connector.connectorId, connector.hostPath)
    ]);
}
