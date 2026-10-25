/**
 * The manifest robot-code releases beside a set's Part Studios, as a file tab
 * (`fasteners.parts.json`): each studio's configuration and parts, by its tab
 * in that document. A load reads it from the version it loads, so a generated
 * tab's records are always its own release's.
 */
import { z } from "zod";
import { parseOnshapeConfiguration } from "../load/parse-configuration";
import {
    type OnshapeConfigurationResponse,
    OnshapeElementType,
    type OnshapeElement
} from "../../lib/onshape/types";
import { type GeneratedStudio } from "./studios";

export const RELEASED_MANIFEST_SUFFIX = ".parts.json";

const recordSchema = z.object({
    values: z.record(z.string(), z.string()),
    name: z.string(),
    vendor: z.string().optional(),
    partNumber: z.string().optional(),
    url: z.string().optional(),
    material: z.string()
});

export type GeneratedRecord = z.infer<typeof recordSchema>;

const studioSchema = z.object({
    feature: z.string(),
    elementId: z.string(),
    configuration: z
        .object({ configurationParameters: z.array(z.unknown()) })
        .loose(),
    records: z.array(recordSchema)
});

const manifestSchema = z
    .object({ studios: z.record(z.string(), studioSchema) })
    .loose();

/** A tab a manifest names: which set's studio it is, and which manifest says so. */
export interface GeneratedTab {
    set: string;
    key: string;
    manifestElementId: string;
}

/** One studio of a released manifest, as small as a step can return. */
export interface ReleasedStudio {
    set: string;
    key: string;
    feature: string;
    /** As robot-code sends it to Onshape, as an update call. */
    configuration: Omit<OnshapeConfigurationResponse, "btType">;
    records: GeneratedRecord[];
}

export class GeneratedManifestError extends Error {}

/** The tabs holding a set's released manifest. */
export function findManifestTabs(elements: OnshapeElement[]): OnshapeElement[] {
    return elements.filter(
        (element) =>
            element.elementType === OnshapeElementType.BLOB &&
            element.name.endsWith(RELEASED_MANIFEST_SUFFIX)
    );
}

export function setOf(manifestTab: OnshapeElement): string {
    return manifestTab.name.slice(0, -RELEASED_MANIFEST_SUFFIX.length);
}

export function parseManifest(
    text: string,
    tabName: string
): z.infer<typeof manifestSchema> {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new GeneratedManifestError(`${tabName} isn't JSON.`);
    }
    const parsed = manifestSchema.safeParse(json);
    if (!parsed.success) {
        throw new GeneratedManifestError(
            `${tabName} isn't a part set's manifest: ${parsed.error.message}`
        );
    }
    return parsed.data;
}

/** Which tab each of a manifest's studios is, by element id. */
export function generatedTabs(
    manifest: z.infer<typeof manifestSchema>,
    set: string,
    manifestElementId: string
): Record<string, GeneratedTab> {
    return Object.fromEntries(
        Object.entries(manifest.studios).map(([key, studio]) => [
            studio.elementId,
            { set, key, manifestElementId }
        ])
    );
}

export function releasedStudio(
    manifest: z.infer<typeof manifestSchema>,
    tab: GeneratedTab
): ReleasedStudio {
    const studio = manifest.studios[tab.key];
    if (!studio) {
        throw new GeneratedManifestError(
            `${tab.set}'s manifest has no studio ${tab.key}.`
        );
    }
    return {
        set: tab.set,
        key: tab.key,
        feature: studio.feature,
        configuration: studio.configuration as unknown as Omit<
            OnshapeConfigurationResponse,
            "btType"
        >,
        records: studio.records
    };
}

/** What a load keeps of a manifest beyond its studios' tabs: each studio's feature, and the rest of it. */
export interface ReleasedCatalog {
    features: Record<string, string>;
    catalog: Record<string, unknown>;
}

export function releasedCatalog(
    manifest: z.infer<typeof manifestSchema>
): ReleasedCatalog {
    const { studios, ...rest } = manifest;
    const catalog: Record<string, unknown> = { ...rest };
    delete catalog.source;
    return {
        features: Object.fromEntries(
            Object.entries(studios).map(([key, studio]) => [
                key,
                studio.feature
            ])
        ),
        catalog
    };
}

/** A released studio as the records check reads it. */
export function toGeneratedStudio(studio: ReleasedStudio): GeneratedStudio {
    return {
        set: studio.set,
        key: studio.key,
        feature: studio.feature,
        // As Onshape answers it, which robot-code sends as an update call
        parameters: parseOnshapeConfiguration({
            ...studio.configuration,
            btType: "BTConfigurationResponse-2019"
        })
    };
}
