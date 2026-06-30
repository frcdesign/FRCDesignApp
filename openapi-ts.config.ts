import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates TypeScript types for the slice of the Onshape API we use.
 *
 * Run with `npm run gen:onshape-types`. Output lands in
 * `src/backend/onshape-api/generated/` and is committed.
 *
 * The upstream Onshape spec (https://cad.onshape.com/api/openapi) is OpenAPI
 * 3.0.1, marks *nothing* `required`, and types every `btType` discriminator as a
 * bare `string`. It also models polymorphism with `allOf` inheritance + a
 * `discriminator` on the base — which @hey-api does not expand into a union, so the
 * concrete subtypes are unreachable by `$ref` and get pruned by `orphans: false`.
 *
 * We use @hey-api's parser layer to fix the schema in place before generation
 * rather than hand-editing the output:
 *
 *  - `patch.input` rewrites each polymorphic point to an explicit `oneOf` of the
 *    concrete subtypes (via the `OnshapeConfigurationParameter` /
 *    `OnshapeVisibilityCondition` / `OnshapeEnumOptionVisibilityCondition` union
 *    schemas) so the subtypes are referenced — and thus retained — and emitted as a
 *    discriminated union. It also drops the now-redundant discriminators.
 *  - `patch.schemas` narrows each `btType` to a single-value `enum` literal and marks
 *    the fields our parser reads as `required`.
 *  - `filters` keeps only the configuration operations (+ `orphans: false`).
 *
 * NOTE: the spec also has a `parameterType` field whose enum is
 * `ENUM | BOOLEAN | STRING | QUANTITY` (schema `GBTConfigurationParameterType`).
 * That is NOT the `btType` discriminator our `ConfigurationParameterType` enum
 * encodes (`BTMConfigurationParameterEnum-105`, ...) — do not conflate the two.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// Some Onshape schemas keep their inline `properties` at the top level, others
// inside an `allOf` member (the base type is referenced via `$ref`). Collect every
// object in a schema that actually declares properties so patches land correctly.
interface Bag {
    properties?: Record<string, any>;
    required?: string[];
}
function propertyBags(schema: any): Bag[] {
    const bags: Bag[] = [];
    if (schema.properties) bags.push(schema);
    if (Array.isArray(schema.allOf)) {
        for (const part of schema.allOf) {
            if (part && part.properties) bags.push(part);
        }
    }
    return bags;
}

/** Replace every `btType` (typed as bare `string`) with a single-value enum literal. */
function setBtType(schema: any, value: string): void {
    for (const bag of propertyBags(schema)) {
        if (bag.properties && bag.properties.btType) {
            bag.properties.btType = { type: "string", enum: [value] };
        }
    }
}

/** Mark fields `required` on the bag that declares the bulk of the properties. */
function require(schema: any, fields: string[]): void {
    const bags = propertyBags(schema);
    const target = bags.length ? bags[bags.length - 1] : (schema as Bag);
    target.required = Array.from(
        new Set([...(target.required ?? []), ...fields])
    );
}

/** Drop properties we never read so they (and any types they drag in) are pruned. */
function omit(schema: any, fields: string[]): void {
    for (const bag of propertyBags(schema)) {
        for (const field of fields) delete bag.properties?.[field];
    }
}

export default defineConfig({
    input: "https://cad.onshape.com/api/openapi",
    output: "src/backend/onshape-api/generated",
    plugins: ["@hey-api/typescript"],
    parser: {
        // No request/response splitting — these are read-only response shapes.
        transforms: { readWrite: false },
        filters: {
            // Keep only the configuration endpoints we call; drop everything else.
            operations: {
                include: [
                    "GET /elements/d/{did}/{wvm}/{wvmid}/e/{eid}/configuration",
                    "GET /elements/d/{did}/{wvm}/{wvmid}/e/{eid}/configurationencodings/{cid}"
                ]
            },
            orphans: false
        },
        patch: {
            // Runs first. Turn the allOf-inheritance + discriminator polymorphism into
            // explicit `oneOf` unions so the concrete subtypes survive orphan pruning.
            input: (spec: any) => {
                const schemas = spec.components.schemas;

                schemas.OnshapeConfigurationParameter = {
                    oneOf: [
                        ref("BTMConfigurationParameterEnum-105"),
                        ref("BTMConfigurationParameterBoolean-2550"),
                        ref("BTMConfigurationParameterString-872"),
                        ref("BTMConfigurationParameterQuantity-1826")
                    ]
                };
                // A literal-`btType` member for the "none" sentinel the API sends
                // (`BTParameterVisibilityCondition-177`). We can't reuse the actual base
                // schema here: its subtypes inherit from it via `allOf`, so giving the
                // base a literal `btType` would intersect to `never` on every subtype.
                schemas.OnshapeVisibilityNone = {
                    type: "object",
                    properties: {
                        btType: {
                            type: "string",
                            enum: ["BTParameterVisibilityCondition-177"]
                        }
                    },
                    required: ["btType"]
                };
                schemas.OnshapeVisibilityCondition = {
                    oneOf: [
                        ref("BTParameterVisibilityLogical-178"),
                        ref("BTParameterVisibilityOnEqual-180"),
                        ref("BTParameterVisibilityInRange-2980"),
                        ref("BTParameterVisibilityAlwaysShown-5487"),
                        ref("OnshapeVisibilityNone")
                    ]
                };
                schemas.OnshapeEnumOptionVisibilityCondition = {
                    oneOf: [
                        ref("BTEnumOptionVisibilityForList-1613"),
                        ref("BTEnumOptionVisibilityForRange-4297")
                    ]
                };

                // Repoint the polymorphic references at the new unions.
                schemas[
                    "BTConfigurationResponse-2019"
                ].properties.configurationParameters.items = ref(
                    "OnshapeConfigurationParameter"
                );
                for (const part of schemas["BTMConfigurationParameter-819"]
                    .allOf ?? []) {
                    if (part.properties?.visibilityCondition) {
                        part.properties.visibilityCondition = ref(
                            "OnshapeVisibilityCondition"
                        );
                    }
                }
                for (const part of schemas["BTParameterVisibilityLogical-178"]
                    .allOf ?? []) {
                    if (part.properties?.children) {
                        part.properties.children.items = ref(
                            "OnshapeVisibilityCondition"
                        );
                    }
                }
                schemas[
                    "BTEnumOptionVisibilityCondition-3455"
                ].properties.condition = ref("OnshapeVisibilityCondition");
                schemas[
                    "BTEnumOptionVisibilityConditionList-2936"
                ].properties.visibilityConditions.items = ref(
                    "OnshapeEnumOptionVisibilityCondition"
                );

                // Drop the now-redundant discriminators on the union bases.
                for (const name of [
                    "BTMConfigurationParameter-819",
                    "BTParameterVisibilityCondition-177",
                    "BTEnumOptionVisibilityCondition-3455",
                    "BTQuantityRange-181"
                ]) {
                    delete schemas[name].discriminator;
                }
            },
            schemas: {
                // --- GET /configuration response ---------------------------------
                "BTConfigurationResponse-2019": (schema: any) => {
                    require(schema, ["configurationParameters"]);
                    // `currentConfiguration` is a huge unrelated parameter tree we
                    // never read — collapse it so it isn't pulled into the output.
                    if (schema.properties?.currentConfiguration) {
                        schema.properties.currentConfiguration = {
                            type: "array",
                            items: {
                                type: "object",
                                additionalProperties: true
                            }
                        };
                    }
                },

                // --- configuration parameter union ------------------------------
                "BTMConfigurationParameter-819": (schema: any) => {
                    // `generatedParameterId` drags in an unused tree node type.
                    omit(schema, ["generatedParameterId"]);
                    require(schema, [
                        "btType",
                        "parameterId",
                        "parameterName",
                        "visibilityCondition"
                    ]);
                },
                "BTMConfigurationParameterEnum-105": (schema: any) => {
                    setBtType(schema, "BTMConfigurationParameterEnum-105");
                    require(schema, ["btType", "defaultValue", "options"]);
                },
                "BTMConfigurationParameterBoolean-2550": (schema: any) => {
                    setBtType(schema, "BTMConfigurationParameterBoolean-2550");
                    require(schema, ["btType", "defaultValue"]);
                },
                "BTMConfigurationParameterString-872": (schema: any) => {
                    setBtType(schema, "BTMConfigurationParameterString-872");
                    require(schema, ["btType", "defaultValue"]);
                },
                "BTMConfigurationParameterQuantity-1826": (schema: any) => {
                    setBtType(schema, "BTMConfigurationParameterQuantity-1826");
                    require(schema, [
                        "btType",
                        "quantityType",
                        "rangeAndDefault"
                    ]);
                },
                "BTMEnumOption-592": (schema: any) => {
                    require(schema, ["option", "optionName"]);
                },
                "BTQuantityRange-181": (schema: any) => {
                    // `location` drags in a large source-location/parse-node tree.
                    omit(schema, ["location"]);
                    require(schema, [
                        "units",
                        "defaultValue",
                        "minValue",
                        "maxValue"
                    ]);
                },

                // --- parameter visibility conditions ----------------------------
                "BTParameterVisibilityLogical-178": (schema: any) => {
                    setBtType(schema, "BTParameterVisibilityLogical-178");
                    require(schema, ["btType", "operation", "children"]);
                },
                "BTParameterVisibilityOnEqual-180": (schema: any) => {
                    setBtType(schema, "BTParameterVisibilityOnEqual-180");
                    require(schema, ["btType", "parameterId", "value"]);
                },
                "BTParameterVisibilityInRange-2980": (schema: any) => {
                    setBtType(schema, "BTParameterVisibilityInRange-2980");
                    require(schema, ["btType", "parameterId", "optionRange"]);
                },
                "BTParameterVisibilityAlwaysShown-5487": (schema: any) => {
                    setBtType(schema, "BTParameterVisibilityAlwaysShown-5487");
                    require(schema, ["btType"]);
                },

                // --- enum option visibility conditions --------------------------
                "BTEnumOptionVisibilityConditionList-2936": (schema: any) => {
                    require(schema, ["visibilityConditions"]);
                },
                "BTEnumOptionVisibilityCondition-3455": (schema: any) => {
                    require(schema, ["btType", "condition"]);
                },
                "BTEnumOptionVisibilityForList-1613": (schema: any) => {
                    setBtType(schema, "BTEnumOptionVisibilityForList-1613");
                    require(schema, ["btType", "controlledOptions"]);
                },
                "BTEnumOptionVisibilityForRange-4297": (schema: any) => {
                    setBtType(schema, "BTEnumOptionVisibilityForRange-4297");
                    require(schema, ["btType", "controlledRange"]);
                },
                "BTEnumOptionRange-3741": (schema: any) => {
                    require(schema, ["start", "end"]);
                },

                // --- GET /configurationencodings/{cid} response -----------------
                BTConfigurationInfo: (schema: any) => {
                    require(schema, ["parameters"]);
                },
                ConfigurationInfoEntry: (schema: any) => {
                    require(schema, ["parameterId", "parameterValue"]);
                }
            }
        }
    }
});
