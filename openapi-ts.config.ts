import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates a committed *reference* dump of the Onshape API operations we use into
 * `onshape-api-reference/` — outside `src/` on purpose, so it stays out of every
 * tsconfig's scope and out of editor auto-import alongside our real types.
 *
 * Run with `npm run gen:onshape-types`.
 *
 * NOTHING imports this output. The types we actually use are hand-authored in
 * `src/backend/onshape-api/onshape-types.ts`, so they can use our own enums and clean
 * discriminated unions. This dump exists only to diff against: re-running codegen
 * surfaces upstream API drift (including fields we don't use yet) to fold in by hand.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// Derived mechanically ("BTMConfigurationParameter-819" ->
// "BTMConfigurationParameter819Union"); reference-only output doesn't need pretty names.
const unionName = (baseName: string) => `${baseName.replace(/-/g, "")}Union`;

/**
 * Discriminator base schemas to synthesize a `oneOf` union sibling for.
 *
 * Onshape models polymorphism as `allOf` inheritance plus a `discriminator` on the base.
 * @hey-api doesn't expand that into a union on its own, and a discriminator's subtypes
 * are unreachable by `$ref` so `orphans: false` prunes them. For each base here,
 * `patch.input` adds a sibling `oneOf` over the base's own `discriminator.mapping`, then
 * repoints the properties that use the base polymorphically at that union.
 *
 * The base is never mutated in place: its subtypes `allOf`-extend it, so replacing it
 * with a union of those subtypes would be circular (`A = B | C`, `B = A & {...}`).
 *
 * Keep this list short — some discriminators fan out to hundreds of subtypes. The
 * FeatureScript feature base (`BTMFeature-134`) is the notable one: operations needing a
 * fully discriminated feature body (`add*Feature`) are excluded from `operations.include`
 * instead. `getPartStudioFeatures` shares that base but is intentionally absent here; its
 * flat fields (recursive `subFeatures`, `mateConnectorFeature`) are all we need, and
 * omitting the union keeps the subtypes pruned.
 */
const UNION_BASES: string[] = [
    "BTMConfigurationParameter-819",
    "BTParameterVisibilityCondition-177",
    "BTEnumOptionVisibilityCondition-3455",
    "BTGroupOrElementReference-2205"
];

/**
 * Fields trimmed because they pull in large, unrelated schema trees we don't use
 * (thumbnail/owner/workspace chains — ~40 schemas for `BTDocumentInfo` alone).
 *
 * A field can be declared both directly on a schema *and* re-declared on its `allOf`
 * bases, so every place it appears needs its own entry to make it disappear.
 */
const OMIT: Record<string, string[]> = {
    // BTDocumentInfo plus its allOf bases (BTGlobalTreeNodeSummaryInfo ->
    // BTGlobalTreeNodeInfo), which re-declare the same fields.
    BTDocumentInfo: [
        "thumbnail",
        "owner",
        "createdBy",
        "modifiedBy",
        "defaultWorkspace",
        "documentLabels",
        "permission"
    ],
    BTGlobalTreeNodeInfo: ["owner", "createdBy", "modifiedBy"],
    BTGlobalTreeNodeSummaryInfo: [
        "defaultWorkspace",
        "documentLabels",
        "permission",
        "thumbnail"
    ],
    // Same thumbnail/user-chain trim on the other included operations.
    BTVersionInfo: ["creator", "lastModifier", "thumbnail"],
    BTDocumentElementInfo: ["thumbnailInfo"]
};

export default defineConfig({
    input: "https://cad.onshape.com/api/openapi",
    output: "onshape-api-reference",
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
                    "GET /documents/d/{did}/{wvm}/{wvmid}/contents",
                    "GET /documents/{did}",
                    "GET /assemblies/d/{did}/{wvm}/{wvmid}/e/{eid}",
                    "GET /partstudios/d/{did}/{wvm}/{wvmid}/e/{eid}/features"
                ]
            },
            orphans: false
        },
        patch: {
            input: (spec: any) => {
                const schemas = spec.components.schemas;

                // The properties object that declares `name` (top-level or in an allOf
                // member), creating a top-level one if it's absent.
                const propsWith = (schema: any, name: string) =>
                    schema.properties?.[name]
                        ? schema.properties
                        : (schema.allOf?.find((p: any) => p.properties?.[name])
                              ?.properties ?? (schema.properties ??= {}));

                // Add the sibling `oneOf` union for each discriminator base.
                for (const baseName of UNION_BASES) {
                    const mapping = schemas[baseName]?.discriminator?.mapping;
                    if (mapping) {
                        schemas[unionName(baseName)] = {
                            oneOf: Object.keys(mapping).map(ref)
                        };
                    }
                }

                // Repoint the specific properties that reference a discriminator base
                // polymorphically (not via `allOf` inheritance) to the new union.
                propsWith(
                    schemas["BTConfigurationResponse-2019"],
                    "configurationParameters"
                ).configurationParameters.items = ref(
                    unionName("BTMConfigurationParameter-819")
                );
                propsWith(
                    schemas["BTMConfigurationParameter-819"],
                    "visibilityCondition"
                ).visibilityCondition = ref(
                    unionName("BTParameterVisibilityCondition-177")
                );
                propsWith(
                    schemas["BTParameterVisibilityLogical-178"],
                    "children"
                ).children.items = ref(
                    unionName("BTParameterVisibilityCondition-177")
                );
                propsWith(
                    schemas["BTEnumOptionVisibilityCondition-3455"],
                    "condition"
                ).condition = ref(
                    unionName("BTParameterVisibilityCondition-177")
                );
                propsWith(
                    schemas["BTEnumOptionVisibilityConditionList-2936"],
                    "visibilityConditions"
                ).visibilityConditions.items = ref(
                    unionName("BTEnumOptionVisibilityCondition-3455")
                );
                propsWith(
                    schemas["BTElementGroup-1458"],
                    "groups"
                ).groups.items = ref(
                    unionName("BTGroupOrElementReference-2205")
                );

                for (const [name, fields] of Object.entries(OMIT)) {
                    const schema = schemas[name];
                    if (!schema) continue;
                    for (const field of fields) {
                        for (const bag of [schema, ...(schema.allOf ?? [])]) {
                            delete bag.properties?.[field];
                        }
                    }
                }
            }
        }
    }
});
