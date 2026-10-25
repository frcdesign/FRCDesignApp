/** A `FastenerSet` as a library loads one, from robot-code's manifest (synced by `npm run sync:generated-parts`). */
import { catalogSchema } from "@backend/features/quick-fastener/catalog";
import {
    FastenerKind,
    type FastenerSet,
    type FastenerStudio
} from "@backend/features/quick-fastener/studios";
import { parseOnshapeConfiguration } from "@backend/features/load/parse-configuration";
import { type OnshapeConfigurationResponse } from "@backend/lib/onshape/types";
import { FASTENERS_MANIFEST } from "./fasteners-manifest.gen";

/** Where the tests' studios are released: one version, a tab each. */
export const FASTENERS_VERSION = { documentId: "lib", versionId: "libv" };

function studio(kind: FastenerKind): FastenerStudio {
    const { configuration } = FASTENERS_MANIFEST.studios[kind];
    return {
        parameters: parseOnshapeConfiguration({
            ...(configuration as unknown as Omit<
                OnshapeConfigurationResponse,
                "btType"
            >),
            btType: "BTConfigurationResponse-2019"
        }),
        location: { ...FASTENERS_VERSION, elementId: `${kind}Studio` }
    };
}

export const FASTENER_SET: FastenerSet = {
    catalog: catalogSchema.parse(FASTENERS_MANIFEST),
    studios: {
        [FastenerKind.SCREW]: studio(FastenerKind.SCREW),
        [FastenerKind.WASHER]: studio(FastenerKind.WASHER),
        [FastenerKind.NUT]: studio(FastenerKind.NUT)
    }
};
