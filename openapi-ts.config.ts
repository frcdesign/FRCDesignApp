import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates TypeScript types for the slice of the Onshape API we use.
 *
 * Run with `npm run gen:onshape-types`. Output lands in
 * `src/backend/onshape-api/generated/` and is committed.
 *
 * The upstream Onshape spec (https://cad.onshape.com/api/openapi) is OpenAPI
 * 3.0.1, marks *nothing* `required`, types every `btType` discriminator as a bare
 * `string`, and models polymorphism with `allOf` inheritance + a `discriminator` on
 * the base — which @hey-api does not expand into a union, so the concrete subtypes
 * are unreachable by `$ref` and get pruned by `orphans: false`.
 *
 * We fix the schema in @hey-api's parser layer rather than hand-editing the output:
 *  - `UNIONS` replaces each polymorphic point with an explicit `oneOf` so the
 *    subtypes are referenced (and kept) and emitted as a discriminated union.
 *  - `SCHEMAS` pins each `btType` to a literal and marks the fields we read required.
 *  - `filters` keeps only the configuration operations (+ `orphans: false`).
 *
 * Adding an endpoint is mostly adding rows to `UNIONS` / `SCHEMAS` below.
 *
 * NOTE: the spec's `parameterType` enum (`ENUM | BOOLEAN | STRING | QUANTITY`,
 * schema `GBTConfigurationParameterType`) is NOT the `btType` discriminator our
 * `ConfigurationParameterType` enum encodes — do not conflate the two.
 */

const NONE = "BTParameterVisibilityCondition-177";

// Discriminated unions to synthesize. Keys become exported type names; values are
// the concrete member schemas. `OnshapeVisibilityNone` is a standalone literal-btType
// stand-in for the "no condition" sentinel (the real base can't be reused — its
// subtypes inherit from it via `allOf`, so a literal btType there collapses to never).
const UNIONS: Record<string, string[]> = {
    OnshapeConfigurationParameter: [
        "BTMConfigurationParameterEnum-105",
        "BTMConfigurationParameterBoolean-2550",
        "BTMConfigurationParameterString-872",
        "BTMConfigurationParameterQuantity-1826"
    ],
    OnshapeVisibilityCondition: [
        "BTParameterVisibilityLogical-178",
        "BTParameterVisibilityOnEqual-180",
        "BTParameterVisibilityInRange-2980",
        "BTParameterVisibilityAlwaysShown-5487",
        "OnshapeVisibilityNone"
    ],
    OnshapeEnumOptionVisibilityCondition: [
        "BTEnumOptionVisibilityForList-1613",
        "BTEnumOptionVisibilityForRange-4297"
    ]
};

// Per-schema fixups. `btType` pins the discriminator to a literal; `required` marks
// the fields our parser reads; `omit` drops fields that only drag in unused types.
const SCHEMAS: Record<
    string,
    { btType?: string; required?: string[]; omit?: string[] }
> = {
    "BTConfigurationResponse-2019": {
        btType: "BTConfigurationResponse-2019",
        required: ["configurationParameters"]
    },
    "BTMConfigurationParameter-819": {
        required: [
            "isCosmetic",
            "parameterId",
            "parameterName",
            "visibilityCondition"
        ],
        omit: ["generatedParameterId"]
    },
    "BTMConfigurationParameterEnum-105": {
        btType: "BTMConfigurationParameterEnum-105",
        required: ["defaultValue", "options"]
    },
    "BTMConfigurationParameterBoolean-2550": {
        btType: "BTMConfigurationParameterBoolean-2550",
        required: ["defaultValue"]
    },
    "BTMConfigurationParameterString-872": {
        btType: "BTMConfigurationParameterString-872",
        required: ["defaultValue"]
    },
    "BTMConfigurationParameterQuantity-1826": {
        btType: "BTMConfigurationParameterQuantity-1826",
        required: ["quantityType", "rangeAndDefault"]
    },
    "BTMEnumOption-592": { required: ["option", "optionName"] },
    "BTQuantityRange-181": {
        required: ["units", "defaultValue", "minValue", "maxValue"],
        omit: ["location"]
    },
    "BTParameterVisibilityLogical-178": {
        btType: "BTParameterVisibilityLogical-178",
        required: ["operation", "children"]
    },
    "BTParameterVisibilityOnEqual-180": {
        btType: "BTParameterVisibilityOnEqual-180",
        required: ["parameterId", "value"]
    },
    "BTParameterVisibilityInRange-2980": {
        btType: "BTParameterVisibilityInRange-2980",
        required: ["parameterId", "optionRange"]
    },
    "BTParameterVisibilityAlwaysShown-5487": {
        btType: "BTParameterVisibilityAlwaysShown-5487"
    },
    "BTEnumOptionVisibilityConditionList-2936": {
        required: ["visibilityConditions"]
    },
    "BTEnumOptionVisibilityCondition-3455": { required: ["condition"] },
    "BTEnumOptionVisibilityForList-1613": {
        btType: "BTEnumOptionVisibilityForList-1613",
        required: ["controlledOptions"]
    },
    "BTEnumOptionVisibilityForRange-4297": {
        btType: "BTEnumOptionVisibilityForRange-4297",
        required: ["controlledRange"]
    },
    "BTEnumOptionRange-3741": { required: ["start", "end"] },
    BTConfigurationInfo: { required: ["parameters"] },
    ConfigurationInfoEntry: { required: ["parameterId", "parameterValue"] }
};

// Discriminator bases whose polymorphism we replace with the `UNIONS` above.
const DROP_DISCRIMINATORS = [
    "BTMConfigurationParameter-819",
    "BTParameterVisibilityCondition-177",
    "BTEnumOptionVisibilityCondition-3455",
    "BTQuantityRange-181"
];

export default defineConfig({
    input: "https://cad.onshape.com/api/openapi",
    output: "src/backend/onshape-api/generated",
    plugins: ["@hey-api/typescript"],
    parser: {
        // No request/response splitting — these are read-only response shapes.
        transforms: { readWrite: false },
        filters: {
            operations: {
                include: [
                    "GET /elements/d/{did}/{wvm}/{wvmid}/e/{eid}/configuration",
                    "GET /elements/d/{did}/{wvm}/{wvmid}/e/{eid}/configurationencodings/{cid}"
                ]
            },
            orphans: false
        },
        patch: {
            input: (spec: any) => {
                const schemas = spec.components.schemas;
                const ref = (name: string) => ({
                    $ref: `#/components/schemas/${name}`
                });
                // The properties object that declares `name` (top-level or in an allOf
                // member), creating a top-level one if it's absent.
                const propsWith = (schema: any, name: string) =>
                    schema.properties?.[name]
                        ? schema.properties
                        : (schema.allOf?.find((p: any) => p.properties?.[name])
                              ?.properties ?? (schema.properties ??= {}));

                // 1. Synthesize the discriminated unions.
                schemas.OnshapeVisibilityNone = {
                    type: "object",
                    properties: { btType: { type: "string", enum: [NONE] } },
                    required: ["btType"]
                };
                for (const [name, members] of Object.entries(UNIONS)) {
                    schemas[name] = { oneOf: members.map(ref) };
                }

                // 2. Point each polymorphic slot at its union, then drop the now-unused
                //    discriminators so @hey-api emits the bases as plain objects.
                propsWith(
                    schemas["BTConfigurationResponse-2019"],
                    "configurationParameters"
                ).configurationParameters.items = ref(
                    "OnshapeConfigurationParameter"
                );
                propsWith(
                    schemas["BTMConfigurationParameter-819"],
                    "visibilityCondition"
                ).visibilityCondition = ref("OnshapeVisibilityCondition");
                propsWith(
                    schemas["BTParameterVisibilityLogical-178"],
                    "children"
                ).children.items = ref("OnshapeVisibilityCondition");
                propsWith(
                    schemas["BTEnumOptionVisibilityCondition-3455"],
                    "condition"
                ).condition = ref("OnshapeVisibilityCondition");
                propsWith(
                    schemas["BTEnumOptionVisibilityConditionList-2936"],
                    "visibilityConditions"
                ).visibilityConditions.items = ref(
                    "OnshapeEnumOptionVisibilityCondition"
                );
                for (const name of DROP_DISCRIMINATORS) {
                    delete schemas[name].discriminator;
                }

                // 3. `currentConfiguration` is a huge parameter tree we never read.
                propsWith(
                    schemas["BTConfigurationResponse-2019"],
                    "currentConfiguration"
                ).currentConfiguration = {
                    type: "array",
                    items: { type: "object", additionalProperties: true }
                };

                // 4. Pin btType literals, mark required fields, and trim unused ones.
                for (const [name, cfg] of Object.entries(SCHEMAS)) {
                    const schema = schemas[name];
                    if (!schema) continue;
                    for (const field of cfg.omit ?? []) {
                        for (const bag of [schema, ...(schema.allOf ?? [])]) {
                            delete bag.properties?.[field];
                        }
                    }
                    if (cfg.btType) {
                        propsWith(schema, "btType").btType = {
                            type: "string",
                            enum: [cfg.btType]
                        };
                    }
                    const required = [
                        ...(cfg.btType ? ["btType"] : []),
                        ...(cfg.required ?? [])
                    ];
                    if (required.length) {
                        const target =
                            schema.allOf?.find((p: any) => p.properties) ??
                            schema;
                        target.required = [
                            ...new Set([
                                ...(target.required ?? []),
                                ...required
                            ])
                        ];
                    }
                }
            }
        }
    }
});
