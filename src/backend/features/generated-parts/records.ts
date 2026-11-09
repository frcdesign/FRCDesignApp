/**
 * The generated studios' parts, one per configuration, from the manifest
 * released beside them (see `manifest.ts`): what a load indexes in place of
 * asking Onshape about each configuration.
 */
import {
    type ConfigurationParameter,
    type ConfigurationRecord,
    type PartMetadata
} from "../configurations/contract";
import { sameSelection, toSelection } from "../configurations/selection";
import { parseVendor, type Vendor } from "../library/vendors";
import { type GeneratedRecord } from "./manifest";

/** What a load stores for a generated studio, as it would from probing. */
export interface GeneratedConfiguration {
    /** The default configuration's part. */
    partMetadata: PartMetadata;
    /** Every other configuration's. */
    records: ConfigurationRecord[];
    vendors: Vendor[];
}

// A record's url is where to buy it, which its feature sets as its description
function toRecord(record: GeneratedRecord): ConfigurationRecord {
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

/** A generated studio's parts, the default's told apart by the tab's own parameters. */
export function generatedConfiguration(
    parameters: ConfigurationParameter[],
    generatedRecords: GeneratedRecord[]
): GeneratedConfiguration {
    const defaults = toSelection({}, parameters);
    const records = generatedRecords.map(toRecord);
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
