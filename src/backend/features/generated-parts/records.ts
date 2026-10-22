/**
 * The generated studios' parts, one per configuration (synced into
 * `records.gen.ts`): what a load indexes in place of asking Onshape about each
 * configuration. The server's alone, since the client never needs them.
 */
import { enumerateConfigurations } from "../configurations/combinations";
import {
    type ConfigurationParameter,
    type ConfigurationRecord,
    type PartialSelection,
    ParameterType,
    type PartMetadata
} from "../configurations/contract";
import { sameSelection, toSelection } from "../configurations/selection";
import { parseVendor, type Vendor } from "../library/vendors";
import { type GeneratedStudio } from "./studios";
import { GENERATED_RECORDS } from "./records.gen";

/** A part as robot-code names it: what its feature sets as its properties. */
interface SyncedRecord {
    values: Record<string, string>;
    name: string;
    /** The Vendor property; Generic parts have none. */
    vendor?: string;
    partNumber?: string;
    /** Where to buy it, which the feature sets as its description. */
    url?: string;
    material: string;
}

const RECORDS = GENERATED_RECORDS as unknown as Record<string, SyncedRecord[]>;

/** What a load stores for a generated studio, as it would from probing. */
export interface GeneratedConfiguration {
    /** The default configuration's part. */
    partMetadata: PartMetadata;
    /** Every other configuration's. */
    records: ConfigurationRecord[];
    vendors: Vendor[];
}

/**
 * The tab's configuration isn't the one robot-code generated, so its parts
 * aren't the generated records either: the generator is the source of truth,
 * so the load fails rather than probe.
 */
export class GeneratedPartMismatchError extends Error {}

function toRecord(record: SyncedRecord): ConfigurationRecord {
    return {
        values: record.values,
        name: record.name,
        partNumber: record.partNumber,
        description: record.url,
        material: record.material,
        vendor: record.vendor,
        hasMultipleParts: false,
        isOpenComposite: false
    };
}

function key(values: PartialSelection): string {
    return JSON.stringify(Object.entries(values).sort());
}

/**
 * Why a tab's parameters aren't its studio's, or undefined when they are: the
 * same parameters, options and defaults, offering exactly the configurations
 * robot-code named a part for. Conditions are compared by what they show, not
 * how Onshape spells them.
 */
export function describeMismatch(
    studio: GeneratedStudio,
    parameters: ConfigurationParameter[]
): string | undefined {
    const shape = (each: ConfigurationParameter[]) =>
        JSON.stringify(
            each.map((parameter) => ({
                id: parameter.id,
                name: parameter.name,
                type: parameter.type,
                default: parameter.default,
                options:
                    parameter.type === ParameterType.ENUM
                        ? parameter.options
                        : undefined
            }))
        );
    if (shape(parameters) !== shape(studio.parameters)) {
        return "Its configuration's inputs aren't the generated ones.";
    }
    const records = RECORDS[`${studio.set}/${studio.key}`] ?? [];
    const { configurations, capped } = enumerateConfigurations(
        parameters,
        [],
        records.length
    );
    const offered = new Set(configurations.map(key));
    if (
        capped ||
        offered.size !== records.length ||
        records.some((record) => !offered.has(key(record.values)))
    ) {
        return "Its configuration offers other options than the generated parts.";
    }
    return undefined;
}

/** A generated studio's parts, once its tab's parameters are checked against it. */
export function generatedConfiguration(
    studio: GeneratedStudio,
    parameters: ConfigurationParameter[]
): GeneratedConfiguration {
    const mismatch = describeMismatch(studio, parameters);
    if (mismatch) {
        throw new GeneratedPartMismatchError(
            `${studio.set}/${studio.key}: ${mismatch}`
        );
    }
    const defaults = toSelection({}, parameters);
    const records = (RECORDS[`${studio.set}/${studio.key}`] ?? []).map(
        toRecord
    );
    const defaultRecord = records.find((record) =>
        sameSelection(toSelection(record.values, parameters), defaults)
    );
    const vendors = [
        ...new Set(records.map((record) => parseVendor(record.vendor)))
    ].filter((vendor): vendor is Vendor => vendor !== undefined);
    const partMetadata: PartMetadata = defaultRecord
        ? {
              name: defaultRecord.name,
              partNumber: defaultRecord.partNumber,
              description: defaultRecord.description,
              material: defaultRecord.material,
              vendor: defaultRecord.vendor,
              hasMultipleParts: false,
              isOpenComposite: false
          }
        : { hasMultipleParts: false, isOpenComposite: false };
    return {
        partMetadata,
        records: records.filter((record) => record !== defaultRecord),
        vendors
    };
}
