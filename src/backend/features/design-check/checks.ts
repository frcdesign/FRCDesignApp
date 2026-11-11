/** Pure: what a snapshot of a Part Studio or Assembly breaks of FRCDesign's practices. */
import { ElementType } from "../../lib/onshape/element-type";
import type {
    OnshapeAssemblyDefinition,
    OnshapeAssemblyInstance,
    OnshapeFeatureListResponse,
    OnshapeSketchList,
    OnshapeSketchSolveStatus
} from "../../lib/onshape/types";
import {
    compareSeverity,
    type DesignIssue,
    DesignIssueFix,
    DesignIssueType,
    getDesignIssueSeverity
} from "./contract";
import type {
    AssemblySnapshot,
    DesignSnapshot,
    PartStudioSnapshot
} from "./snapshot";

/** FRCDesign's Origin Cube FeatureScript: https://frcdesign.org/best-practices/assembly-setup/ */
const ORIGIN_CUBE_DOCUMENT_ID = "321c197a842fc5f1a29e6621";
/** Matches a copy of the FeatureScript kept in another document, by its name. */
const ORIGIN_CUBE_FEATURE_NAME = /^origin cube\b/i;
/** What the Origin Cube is called where Onshape sends its name unresolved. */
const ORIGIN_CUBE_NAME = "Origin Cube";
/** The cube the feature makes, which brings its own material and no part number. */
const ORIGIN_CUBE_PART_NAME = /^(origin cube|cube of all time)$/i;

export interface DesignCheckResult {
    /** Worst first at FRCDesign's levels, those off by default last. */
    issues: DesignIssue[];
    /** Unsuppressed sketches exist and Onshape reported none's status. */
    sketchStatusUnknown: boolean;
}

type Feature = OnshapeFeatureListResponse["features"][number];
type FeatureParameter = NonNullable<Feature["parameters"]>[number];

export function checkDesign(snapshot: DesignSnapshot): DesignCheckResult {
    switch (snapshot.elementType) {
        case ElementType.PART_STUDIO:
            return checkPartStudio(snapshot);
        case ElementType.ASSEMBLY:
            return {
                issues: bySeverity([
                    ...checkOriginCubeFastened(snapshot.definition),
                    ...checkFeatures(snapshot.features),
                    ...checkInstances(snapshot)
                ]),
                sketchStatusUnknown: false
            };
    }
}

function checkPartStudio(snapshot: PartStudioSnapshot): DesignCheckResult {
    const statuses = sketchStatuses(snapshot.sketches);
    const sketches = checkSketches(snapshot.features, statuses);
    const originCube = checkOriginCube(snapshot.features);
    // Each is yellow too, and reported once, as itself: an over-defined sketch,
    // and the Origin Cube anywhere but first, which it refuses. Red still shows.
    const reported = new Set(
        [...sketches, ...originCube]
            .filter(
                (issue) =>
                    issue.type === DesignIssueType.SKETCH_OVERDEFINED ||
                    issue.type === DesignIssueType.ORIGIN_CUBE_NOT_FIRST
            )
            .map((issue) => issue.featureId)
    );
    const features = checkFeatures(snapshot.features).filter(
        (issue) =>
            issue.type !== DesignIssueType.FEATURE_WARNING ||
            !reported.has(issue.featureId)
    );
    // Onshape lists no sketch below the rollback bar.
    const hasSketches = builtFeatures(snapshot.features).some(
        (feature) => isSketch(feature) && !feature.suppressed
    );
    return {
        issues: bySeverity([
            ...originCube,
            ...sketches,
            ...features,
            ...checkMissingSelections(snapshot.features),
            ...checkRollback(snapshot.features),
            ...checkParts(snapshot)
        ]),
        sketchStatusUnknown: hasSketches && statuses.size === 0
    };
}

function bySeverity(issues: DesignIssue[]): DesignIssue[] {
    return issues.toSorted((a, b) =>
        compareSeverity(
            getDesignIssueSeverity(a.type),
            getDesignIssueSeverity(b.type)
        )
    );
}

function isSketch(feature: Feature): boolean {
    return feature.featureType === "newSketch";
}

/** A FeatureScript feature can name itself from a template, which Onshape sends unfilled, as `#_name`. */
function featureName(feature: Feature): string {
    // A nameless one goes by its id rather than failing the whole check.
    const name = feature.name || feature.featureId;
    return name.startsWith("#") && isOriginCube(feature)
        ? ORIGIN_CUBE_NAME
        : name;
}

export function isOriginCube(feature: Feature): boolean {
    if (isSketch(feature)) {
        return false;
    }
    // Only a custom feature has a namespace, so a mate or extrude named for the
    // cube isn't taken for it.
    const namespace = feature.namespace ?? "";
    return (
        namespace.startsWith(`d${ORIGIN_CUBE_DOCUMENT_ID}::`) ||
        (namespace !== "" && ORIGIN_CUBE_FEATURE_NAME.test(feature.name))
    );
}

/** Every Part Studio starts with the Origin Cube, which is never suppressed. */
function checkOriginCube(response: OnshapeFeatureListResponse): DesignIssue[] {
    const index = response.features.findIndex(isOriginCube);
    if (index === -1) {
        return [{ type: DesignIssueType.ORIGIN_CUBE_MISSING }];
    }
    const cube = response.features[index];
    const target = { subject: featureName(cube), featureId: cube.featureId };
    return [
        ...(cube.suppressed
            ? [{ type: DesignIssueType.ORIGIN_CUBE_SUPPRESSED, ...target }]
            : []),
        ...(index > 0
            ? [
                  {
                      type: DesignIssueType.ORIGIN_CUBE_NOT_FIRST,
                      ...target,
                      count: index + 1
                  }
              ]
            : [])
    ];
}

/** Keyed by the sketch's feature id. */
function sketchStatuses(
    sketches: OnshapeSketchList | undefined
): Map<string, OnshapeSketchSolveStatus> {
    const statuses = new Map<string, OnshapeSketchSolveStatus>();
    for (const sketch of sketches?.sketches ?? []) {
        if (sketch.sketchSolveStatus) {
            statuses.set(sketch.featureId, sketch.sketchSolveStatus);
        }
    }
    return statuses;
}

function checkSketches(
    response: OnshapeFeatureListResponse,
    statuses: Map<string, OnshapeSketchSolveStatus>
): DesignIssue[] {
    return response.features.flatMap((feature): DesignIssue[] => {
        if (!isSketch(feature) || feature.suppressed) {
            return [];
        }
        const target = {
            subject: featureName(feature),
            featureId: feature.featureId
        };
        switch (statuses.get(feature.featureId)) {
            case "UNDERDEFINED":
                return [
                    { type: DesignIssueType.SKETCH_UNDERDEFINED, ...target }
                ];
            case "OVERDEFINED":
                return [
                    { type: DesignIssueType.SKETCH_OVERDEFINED, ...target }
                ];
            default:
                return [];
        }
    });
}

/** Red and yellow features or mates, and suppressed ones left in the list. */
function checkFeatures(response: OnshapeFeatureListResponse): DesignIssue[] {
    return response.features.flatMap((feature): DesignIssue[] => {
        const target = {
            subject: featureName(feature),
            featureId: feature.featureId
        };
        if (feature.suppressed) {
            // The Origin Cube has its own, louder issue.
            return isOriginCube(feature)
                ? []
                : [{ type: DesignIssueType.FEATURE_SUPPRESSED, ...target }];
        }
        switch (response.featureStates?.[feature.featureId]?.featureStatus) {
            case "ERROR":
                return [{ type: DesignIssueType.FEATURE_ERROR, ...target }];
            case "WARNING":
                return [{ type: DesignIssueType.FEATURE_WARNING, ...target }];
            default:
                return [];
        }
    });
}

/**
 * Onshape draws a feature yellow once a pick it was given is gone, and still
 * calls it OK. A selection box holding a pick that resolves beside one that
 * resolves to nothing has lost that one; a box of only unresolved picks may
 * be a sketch's plane on Top, which never resolves.
 */
function checkMissingSelections(
    response: OnshapeFeatureListResponse
): DesignIssue[] {
    return builtFeatures(response)
        .filter((feature) => !feature.suppressed)
        .filter((feature) => {
            const status =
                response.featureStates?.[feature.featureId]?.featureStatus;
            return status !== "WARNING" && status !== "ERROR";
        })
        .filter((feature) => feature.parameters?.some(hasLostPick))
        .map((feature) => ({
            type: DesignIssueType.FEATURE_WARNING,
            subject: featureName(feature),
            featureId: feature.featureId
        }));
}

function hasLostPick(parameter: FeatureParameter): boolean {
    const resolves = (parameter.queries ?? []).map(
        (query) => (query.deterministicIds?.length ?? 0) > 0
    );
    return resolves.includes(true) && resolves.includes(false);
}

/** The features above the rollback bar, which are all Onshape builds. */
function builtFeatures(response: OnshapeFeatureListResponse): Feature[] {
    const { rollbackIndex = -1 } = response;
    return rollbackIndex < 0
        ? response.features
        : response.features.slice(0, rollbackIndex);
}

/** Features below the rollback bar are left out of the model. */
function checkRollback(response: OnshapeFeatureListResponse): DesignIssue[] {
    const { rollbackIndex } = response;
    const total = response.features.length;
    if (
        rollbackIndex === undefined ||
        rollbackIndex < 0 ||
        rollbackIndex >= total
    ) {
        return [];
    }
    return [
        {
            type: DesignIssueType.ROLLBACK_NOT_AT_END,
            count: total - rollbackIndex,
            fix: DesignIssueFix.MOVE_ROLLBACK_TO_END
        }
    ];
}

/** A material for mass properties. Solid parts only. */
function checkParts(snapshot: PartStudioSnapshot): DesignIssue[] {
    return snapshot.parts.flatMap((part): DesignIssue[] => {
        const name = part.name ?? part.partId;
        if (
            (part.bodyType && part.bodyType !== "solid") ||
            ORIGIN_CUBE_PART_NAME.test(name)
        ) {
            return [];
        }
        return part.material
            ? []
            : [
                  {
                      type: DesignIssueType.PART_NO_MATERIAL,
                      subject: name,
                      partId: part.partId
                  }
              ];
    });
}

/** FRCDesign fastens the Origin Cube to the assembly origin, and the rest to the cube. */
function checkOriginCubeFastened(
    definition: OnshapeAssemblyDefinition
): DesignIssue[] {
    const root = definition.rootAssembly;
    return root.instances
        .filter((instance) => !instance.suppressed)
        .filter(isOriginCubeInstance)
        .filter((cube) => !isFastenedToOrigin(root.features, cube.id))
        .map((cube) => ({
            type: DesignIssueType.ORIGIN_CUBE_NOT_FASTENED,
            subject: cube.name ?? cube.id,
            instanceId: cube.id,
            partId: cube.partId || undefined,
            fix: DesignIssueFix.FASTEN_ORIGIN_CUBE
        }));
}

/** An unsuppressed fasten naming the instance and nothing else but the origin. */
function isFastenedToOrigin(
    features: OnshapeAssemblyDefinition["rootAssembly"]["features"],
    instanceId: string
): boolean {
    return features.some((feature) => {
        const ends = (feature.featureData?.matedEntities ?? []).map(
            (end) => end.matedOccurrence ?? []
        );
        const isTheInstance = (end: string[]) =>
            end.length === 1 && end[0] === instanceId;
        return (
            !feature.suppressed &&
            feature.featureData?.mateType === "FASTENED" &&
            ends.some(isTheInstance) &&
            ends.every((end) => end.length === 0 || isTheInstance(end))
        );
    });
}

/** An instance of the cube the Origin Cube makes, by the name Onshape numbers it with. */
function isOriginCubeInstance(instance: OnshapeAssemblyInstance): boolean {
    const partName = (instance.name ?? "").replace(/ <\d+>$/, "");
    return instance.type === "Part" && ORIGIN_CUBE_PART_NAME.test(partName);
}

/** What it was inserted from is gone: Onshape no longer says what it is, or which part. */
function isBroken(instance: OnshapeAssemblyInstance): boolean {
    return (
        instance.type === undefined ||
        (instance.type === "Part" && instance.partId === "")
    );
}

/** Top-level instances an unsuppressed mate or group holds, or a pattern copies. */
function heldInstances(definition: OnshapeAssemblyDefinition): Set<string> {
    const root = definition.rootAssembly;
    const held = new Set<string>();
    for (const feature of root.features) {
        if (feature.suppressed) {
            continue;
        }
        for (const entity of feature.featureData?.matedEntities ?? []) {
            const id = entity.matedOccurrence?.[0];
            if (id) held.add(id);
        }
        for (const member of feature.featureData?.occurrences ?? []) {
            const id = member.occurrence?.[0];
            if (id) held.add(id);
        }
    }
    // A pattern's copies move with their seed.
    for (const pattern of root.patterns ?? []) {
        if (pattern.suppressed) {
            continue;
        }
        for (const copies of Object.values(
            pattern.seedToPatternInstances ?? {}
        )) {
            for (const id of copies) held.add(id);
        }
    }
    return held;
}

/** FRCDesign fastens the Origin Cube to the assembly origin rather than fixing parts. */
function checkInstances(snapshot: AssemblySnapshot): DesignIssue[] {
    const root = snapshot.definition.rootAssembly;
    const held = heldInstances(snapshot.definition);
    const fixed = new Set(
        (root.occurrences ?? [])
            .filter((occurrence) => occurrence.path.length === 1)
            .filter((occurrence) => occurrence.fixed)
            .map((occurrence) => occurrence.path[0])
    );
    return root.instances.flatMap((instance): DesignIssue[] => {
        if (instance.suppressed) {
            return [];
        }
        const target = {
            subject: instance.name ?? instance.id,
            instanceId: instance.id,
            // Empty once the part is deleted, which leaves nothing to select.
            partId: instance.partId || undefined
        };
        const issues: DesignIssue[] = [];
        const isBrokenInstance = isBroken(instance);
        if (isBrokenInstance) {
            issues.push({
                type: DesignIssueType.INSTANCE_BROKEN,
                ...target,
                fix: DesignIssueFix.DELETE_INSTANCE
            });
        }
        if (fixed.has(instance.id)) {
            issues.push({ type: DesignIssueType.INSTANCE_FIXED, ...target });
        } else if (
            // A broken instance has nothing left to mate, so it isn't floating
            // too, and a loose Origin Cube is reported as not fastened.
            !isBrokenInstance &&
            !held.has(instance.id) &&
            !isOriginCubeInstance(instance)
        ) {
            issues.push({ type: DesignIssueType.INSTANCE_FLOATING, ...target });
        }
        return issues;
    });
}
