import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates a committed *reference* slice of the Onshape API we consume.
 *
 * Run with `npm run gen:onshape-types`; output lands in
 * `src/backend/onshape-api/generated/`. NOTHING imports this output — the types we
 * actually use are hand-authored in `src/backend/onshape-api/types/*` (so they can use
 * our own enums, comments, and clean discriminated unions). This generated slice exists
 * only as a reference: re-running codegen and diffing it surfaces upstream API drift to
 * fold into the hand-written types.
 *
 * The upstream Onshape spec (https://cad.onshape.com/api/openapi) is OpenAPI 3.0.1, marks
 * *nothing* `required`, types every `btType` discriminator as a bare `string`, and models
 * polymorphism with `allOf` inheritance + a `discriminator` on the base — which @hey-api
 * does not expand into a union, so subtypes are pruned by `orphans: false`. We patch the
 * schema in @hey-api's parser layer so the reference is structured and small:
 *  - `UNIONS` replaces each polymorphic point with an explicit `oneOf`.
 *  - `SCHEMAS` pins `btType` literals, marks fields required, and trims (`keep`/`omit`).
 *  - `keep` strips unread fields before filtering, so their whole dependency trees prune.
 */

const NONE = "BTParameterVisibilityCondition-177";

// Discriminated unions to synthesize. Keys become exported type names; values are the
// concrete member schemas. `OnshapeVisibilityNone` is a standalone literal-btType stand-in
// for the "no condition" sentinel (the real base can't be reused — its subtypes inherit
// from it via `allOf`, so a literal btType there collapses to never).
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
    ],
    // Document folder tree entries (a folder group or an element reference).
    OnshapeFolderEntry: [
        "BTElementGroup-1458",
        "BTDocumentElementReference-2484"
    ]
};

// Per-schema fixups. `btType` pins the discriminator to a literal; `required` marks
// fields we read; `keep` is an allowlist (drop all other properties); `omit` drops
// specific fields. `keep`/`omit` also prune the dependency trees of removed fields.
const SCHEMAS: Record<
    string,
    { btType?: string; required?: string[]; keep?: string[]; omit?: string[] }
> = {
    // --- configuration (GET /configuration) ---
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
    ConfigurationInfoEntry: { required: ["parameterId", "parameterValue"] },

    // --- versions (GET /documents/d/{did}/versions) ---
    BTVersionInfo: {
        keep: ["id", "name", "createdAt"],
        required: ["id", "name", "createdAt"]
    },

    // --- contents (GET /documents/d/{did}/{wvm}/{wvmid}/contents) ---
    BTDocumentContentsInfo: {
        keep: ["folders", "elements"],
        required: ["folders", "elements"]
    },
    "BTElementGroup-1458": {
        btType: "BTElementGroup-1458",
        keep: ["btType", "groups"],
        required: ["btType", "groups"]
    },
    "BTDocumentElementReference-2484": {
        btType: "BTDocumentElementReference-2484",
        keep: ["btType", "elementId"],
        required: ["btType", "elementId"]
    },
    BTDocumentElementInfo: {
        keep: ["id", "name", "elementType", "microversionId"],
        required: ["id", "name", "elementType", "microversionId"]
    }
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
                    "GET /elements/d/{did}/{wvm}/{wvmid}/e/{eid}/configurationencodings/{cid}",
                    "GET /documents/d/{did}/versions",
                    "GET /documents/d/{did}/{wvm}/{wvmid}/contents"
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
                propsWith(
                    schemas["BTElementGroup-1458"],
                    "groups"
                ).groups.items = ref("OnshapeFolderEntry");
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

                // 4. Trim (keep/omit), pin btType literals, and mark required fields.
                for (const [name, cfg] of Object.entries(SCHEMAS)) {
                    const schema = schemas[name];
                    if (!schema) continue;
                    if (cfg.keep) {
                        const allow = new Set(cfg.keep);
                        for (const bag of [schema, ...(schema.allOf ?? [])]) {
                            for (const prop of Object.keys(
                                bag.properties ?? {}
                            )) {
                                if (!allow.has(prop))
                                    delete bag.properties[prop];
                            }
                        }
                    }
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
