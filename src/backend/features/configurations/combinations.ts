/** Only indexed enum and boolean parameters vary; the rest keep their defaults. */
import {
    type PartialSelection,
    BooleanParameter,
    ConfigurationParameter,
    EnumParameter,
    ParameterType
} from "./contract";
import { evaluateCondition, getVisibleOptions } from "./utils";
import { ElementType } from "../../lib/onshape/element-type";

/** Past this nothing is indexed, which bounds load time and Onshape usage. */
export const MAX_PART_NUMBER_CONFIGURATIONS = 512;

/** At or above this, an admin decides whether to index; see `MANUAL_INDEXING_REQUIRED`. */
export const AUTO_INDEX_THRESHOLD = 128;

/** Where a configuration count sits relative to the two indexing limits. */
export enum IndexingBand {
    /** Under {@link AUTO_INDEX_THRESHOLD}: a non-custom insertable indexes on load. */
    AUTOMATIC = "automatic",
    /** Up to {@link MAX_PART_NUMBER_CONFIGURATIONS}: an admin must enable it. */
    MANUAL = "manual",
    /** Over {@link MAX_PART_NUMBER_CONFIGURATIONS}: cannot be indexed at all. */
    EXCEEDED = "exceeded"
}

/** Shared with the admin card so the two can't disagree. */
export function isIndexingEnabled(
    band: IndexingBand,
    indexConfigurations: boolean
): boolean {
    switch (band) {
        case IndexingBand.EXCEEDED:
            return false;
        case IndexingBand.MANUAL:
            return indexConfigurations;
        case IndexingBand.AUTOMATIC:
            return true;
    }
}

export interface ConfigurationCount {
    /** Undefined past the cap, where enumeration stops. */
    count?: number;
    band: IndexingBand;
    /** The combinations counted, so the load path need not enumerate again. */
    configurations: PartialSelection[];
}

/** Shared, so the load path and the admin UI agree on which limit applies. */
export function countConfigurations(
    parameters: ConfigurationParameter[],
    excludedParameterIds: readonly string[] = []
): ConfigurationCount {
    const { configurations, capped } = enumerateConfigurations(
        parameters,
        excludedParameterIds
    );
    if (capped) {
        return { band: IndexingBand.EXCEEDED, configurations: [] };
    }
    // The lone default isn't a configuration of its own.
    const count = configurations.some(
        (selection) => Object.keys(selection).length > 0
    )
        ? configurations.length
        : 0;
    return {
        count,
        band:
            count >= AUTO_INDEX_THRESHOLD
                ? IndexingBand.MANUAL
                : IndexingBand.AUTOMATIC,
        configurations
    };
}

/** An assembly takes none: Onshape can't exclude parameters from one either. */
export function effectiveExclusions(
    elementType: ElementType,
    excludedParameterIds: readonly string[]
): readonly string[] {
    return elementType === ElementType.ASSEMBLY ? [] : excludedParameterIds;
}

/**
 * Never one with a role, which changes how a part is drawn, not which part it
 * is. Shared with the admin card.
 */
export function isIndexedParameter(
    parameter: ConfigurationParameter,
    excludedParameterIds: readonly string[] = []
): parameter is EnumParameter | BooleanParameter {
    return (
        (parameter.type === ParameterType.ENUM ||
            parameter.type === ParameterType.BOOLEAN) &&
        parameter.role === undefined &&
        !excludedParameterIds.includes(parameter.id)
    );
}

/** Empty when visibility leaves no option, so Onshape defaults it. */
export function parameterValues(
    parameter: EnumParameter | BooleanParameter,
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): string[] {
    if (!evaluateCondition(parameter.condition, selection, parameters)) {
        return [];
    }
    if (parameter.type === ParameterType.BOOLEAN) {
        return ["true", "false"];
    }
    return getVisibleOptions(parameter, selection, parameters).map(
        (option) => option.id
    );
}

/** The most combinations counted for display, far past the index cap on work. */
export const MAX_COUNTED_CONFIGURATIONS = 100_000;

/** The true count, which runs past the index cap so the admin card can show it. */
export function countCombinations(
    parameters: ConfigurationParameter[],
    excludedParameterIds: readonly string[] = [],
    cap: number = MAX_COUNTED_CONFIGURATIONS
): number | undefined {
    // Depth-first, holding one path, since only the count is wanted.
    const indexed = parameters.filter((parameter) =>
        isIndexedParameter(parameter, excludedParameterIds)
    );
    let count = 0;
    let capped = false;

    const walk = (depth: number, selection: PartialSelection) => {
        if (depth === indexed.length) {
            // The lone empty default is not a configuration of its own.
            if (Object.keys(selection).length > 0) {
                count++;
                capped = count > cap;
            }
            return;
        }
        const parameter = indexed[depth];
        const values = parameterValues(parameter, selection, parameters);
        if (values.length === 0) {
            walk(depth + 1, selection);
            return;
        }
        for (const value of values) {
            walk(depth + 1, { ...selection, [parameter.id]: value });
            if (capped) {
                return;
            }
        }
    };

    walk(0, {});
    return capped ? undefined : count;
}

interface EnumerateResult {
    /** Only the enums and booleans each combination varies. */
    configurations: PartialSelection[];
    /** True when enumeration was stopped for exceeding the cap. */
    capped: boolean;
}

/**
 * The product of enum and boolean values, minus what visibility hides. Order
 * matters: search dedupes first-wins.
 */
export function enumerateConfigurations(
    parameters: ConfigurationParameter[],
    excludedParameterIds: readonly string[] = [],
    cap: number = MAX_PART_NUMBER_CONFIGURATIONS
): EnumerateResult {
    let configurations: PartialSelection[] = [{}];

    for (const parameter of parameters) {
        if (!isIndexedParameter(parameter, excludedParameterIds)) {
            continue;
        }

        const next: PartialSelection[] = [];
        for (const selection of configurations) {
            const values = parameterValues(parameter, selection, parameters);
            // Left unset, so `toSelection` fills in the default.
            if (values.length === 0) {
                next.push(selection);
                continue;
            }

            for (const value of values) {
                next.push({ ...selection, [parameter.id]: value });
            }
        }

        configurations = next;
        if (configurations.length > cap) {
            return { configurations: [], capped: true };
        }
    }

    return { configurations, capped: false };
}
