/**
 * The manifest robot-code releases beside a set's Part Studios, as a file tab
 * (`fasteners.parts.json`): each studio's configuration and parts, by its tab
 * in that document. A load reads it from the version it loads, so a generated
 * tab's records are always its own release's.
 */
import { z } from "zod";
import {
    OnshapeElementType,
    type OnshapeElement
} from "../../lib/onshape/types";

export const RELEASED_MANIFEST_SUFFIX = ".parts.json";

/** The most a Workflow step returns, which a studio's part of a manifest has to fit in. */
const MAX_STEP_RESULT_BYTES = 1024 * 1024;

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
    mateConnector: z.string().optional(),
    elementId: z.string(),
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

/**
 * A generated studio's tab, its feature type, and the id the feature gives the
 * mate connector it makes: a fasten mate names that
 * `<featureId>.<mateConnector>`, and Onshape's API shows no mate connector a
 * feature makes.
 */
export interface GeneratedFeature {
    elementId: string;
    type: string;
    mateConnector?: string;
}

/** One studio of a released manifest, as small as a step can return. */
export interface ReleasedStudio {
    feature: string;
    mateConnector?: string;
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
        throw new GeneratedManifestError(`Invalid manifest: ${tabName}`);
    }
    const parsed = manifestSchema.safeParse(json);
    if (!parsed.success) {
        // The schema's complaint is for whoever fixes robot-code, so it's logged
        console.error(`Invalid manifest: ${tabName}`, parsed.error.message);
        throw new GeneratedManifestError(`Invalid manifest: ${tabName}`);
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
            `Failed to find manifest's part studio: ${tab.set}/${tab.key}`
        );
    }
    const released = {
        feature: studio.feature,
        mateConnector: studio.mateConnector,
        records: studio.records
    };
    const bytes = new TextEncoder().encode(JSON.stringify(released)).length;
    if (bytes > MAX_STEP_RESULT_BYTES) {
        throw new GeneratedManifestError(
            `Manifest too large: ${tab.set}/${tab.key}`
        );
    }
    return released;
}

/** What a load keeps of a manifest beyond its studios' tabs: each studio's feature, and the rest of it. */
export interface ReleasedCatalog {
    features: Record<string, GeneratedFeature>;
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
                {
                    elementId: studio.elementId,
                    type: studio.feature,
                    mateConnector: studio.mateConnector
                }
            ])
        ),
        catalog
    };
}
