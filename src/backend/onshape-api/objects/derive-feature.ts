import {
    ParameterType,
    type Configuration,
    type ParameterObj
} from "../../../shared/configuration-models";
import { type ElementPath } from "../../../shared/onshape-path";

const PART_STUDIO_QUERY =
    "query=qUnion(qAllModifiableSolidBodies(), qAllModifiableSolidBodies()->qOwnedByBody(EntityType.BODY)->qBodyType(BodyType.MATE_CONNECTOR), qAllModifiableSolidBodies()->qCompositePartsContaining());";

function toNamespace(path: ElementPath, microversionId: string): string {
    return `d${path.documentId}::v${path.instanceId}::e${path.elementId}::m${microversionId}`;
}

function escapeFeatureName(name: string): string {
    // # in part studio feature names declares a variable; ## is a literal #
    return name.replace(/#/g, "##");
}

export class DerivedFeature {
    private readonly namespace: string;
    private readonly escapedName: string;
    private readonly useMateConnector: boolean;
    private readonly partConfiguration: object[] | undefined;

    constructor(
        name: string,
        sourcePath: ElementPath,
        microversionId: string,
        useMateConnector: boolean,
        configuration: Configuration | undefined,
        parameters: ParameterObj[] | undefined
    ) {
        this.escapedName = escapeFeatureName(name);
        this.namespace = toNamespace(sourcePath, microversionId);
        this.useMateConnector = useMateConnector;

        if (
            configuration !== undefined &&
            parameters !== undefined &&
            parameters.length > 0
        ) {
            this.partConfiguration = this.buildPartConfiguration(
                configuration,
                parameters
            );
        }
    }

    private buildPartConfiguration(
        configuration: Configuration,
        parameters: ParameterObj[]
    ): object[] {
        return parameters.map((parameter) => {
            const value = configuration[parameter.id] ?? parameter.default;
            switch (parameter.type) {
                case ParameterType.ENUM:
                    return {
                        btType: "BTMParameterEnum-145",
                        parameterId: parameter.id,
                        value,
                        namespace: this.namespace,
                        enumName: parameter.id + "_conf"
                    };
                case ParameterType.QUANTITY:
                    return {
                        btType: "BTMParameterQuantity-147",
                        parameterId: parameter.id,
                        expression: value
                    };
                case ParameterType.BOOLEAN:
                    return {
                        btType: "BTMParameterBoolean-144",
                        parameterId: parameter.id,
                        value
                    };
                case ParameterType.STRING:
                    return {
                        btType: "BTMParameterString-149",
                        parameterId: parameter.id,
                        value
                    };
            }
        });
    }

    getFeature(): object {
        const partStudioParameter: Record<string, unknown> = {
            btType: "BTMParameterReferencePartStudio-3302",
            parameterId: "partStudio",
            namespace: this.namespace,
            partQuery: {
                btType: "BTMParameterQueryList-148",
                parameterId: "partQuery",
                queries: [
                    {
                        btType: "BTMIndividualQuery-138",
                        queryString: PART_STUDIO_QUERY
                    }
                ]
            }
        };

        if (this.partConfiguration) {
            partStudioParameter.configuration = this.partConfiguration;
        }

        return {
            btType: "BTMFeature-134",
            featureType: "importDerived",
            name: this.escapedName,
            parameters: [
                partStudioParameter,
                {
                    btType: "BTMParameterEnum-145",
                    parameterId: "placement",
                    enumName: "DerivedPlacementType",
                    value: this.useMateConnector
                        ? "AT_MATE_CONNECTOR"
                        : "AT_ORIGIN"
                },
                {
                    btType: "BTMParameterBoolean-144",
                    parameterId: "includeMateConnectors",
                    value: false
                }
            ]
        };
    }
}
