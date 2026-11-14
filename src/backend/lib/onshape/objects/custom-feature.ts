import { type ElementPath } from "../path";

/** A custom feature at its defaults; the client opens its dialog for the rest. */
export class CustomFeature {
    constructor(
        private readonly featureType: string,
        private readonly featureName: string,
        private readonly sourcePath: ElementPath,
        private readonly microversionId: string
    ) {}

    getFeature(): object {
        const { documentId, instanceId, elementId } = this.sourcePath;
        return {
            btType: "BTMFeature-134",
            featureType: this.featureType,
            // # in a feature name declares a variable; ## is a literal #.
            name: this.featureName.replace(/#/g, "##"),
            namespace: `d${documentId}::v${instanceId}::e${elementId}::m${this.microversionId}`,
            parameters: []
        };
    }
}
