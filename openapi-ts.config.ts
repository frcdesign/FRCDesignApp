import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates a gitignored *reference* dump of the Onshape API operations we use.
 *
 * Run with `npm run gen:onshape-types`; output lands in
 * `src/backend/onshape-api/onshape-types.gen/` (gitignored — see .gitignore). NOTHING
 * imports this output — the types we actually use are hand-authored in
 * `src/backend/onshape-api/onshape-types.ts` (so they can use our own enums, comments,
 * and clean discriminated unions). This generated dump exists only as a reference:
 * re-running codegen and diffing it surfaces upstream API drift (including fields we
 * don't currently use) to fold into the hand-written types.
 *
 * The upstream Onshape spec models polymorphism with `allOf` inheritance + a
 * `discriminator` on the base, which @hey-api does not expand into a `oneOf` union on
 * its own — a discriminator's concrete subtypes are unreachable by `$ref` and get pruned
 * by `orphans: false`. `UNIONS` lists `[unionName, baseName]` pairs: for each, we add a
 * *new* sibling schema `unionName` = `oneOf` of every member in `baseName`'s own
 * `discriminator.mapping` (auto-derived, not hand-listed), then repoint the handful of
 * properties that reference the base *polymorphically* (expecting any subtype) to point
 * at the union instead. We deliberately do NOT mutate `baseName` itself in place — its
 * subtypes still `allOf`-extend it directly, and replacing the base with a union that
 * contains its own subtypes creates a circular type (`A = B | C`, `B = A & {...}`).
 *
 * `UNIONS` is deliberately short: some Onshape discriminators (e.g. the FeatureScript
 * feature-type base behind `getFeatures`/`addAssemblyFeature`) fan out to hundreds of
 * subtypes, which is why those operations aren't in `operations.include` below — not
 * "reference" material. `OMIT` trims fields that pull in large, unrelated trees we don't
 * use (thumbnail/owner/workspace chains) — note some fields are declared both directly on
 * a schema *and* re-declared on its `allOf` base(s), so both need an entry to disappear.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// [new union schema name, discriminator base to derive its members from].
const UNIONS: [string, string][] = [
    ["OnshapeConfigurationParameter", "BTMConfigurationParameter-819"],
    ["OnshapeVisibilityCondition", "BTParameterVisibilityCondition-177"],
    [
        "OnshapeEnumOptionVisibilityCondition",
        "BTEnumOptionVisibilityCondition-3455"
    ],
    ["OnshapeFolderEntry", "BTGroupOrElementReference-2205"]
];

const OMIT: Record<string, string[]> = {
    // BTDocumentInfo's own fields, plus the same fields re-declared on its allOf bases
    // (BTGlobalTreeNodeSummaryInfo -> BTGlobalTreeNodeInfo) — together pull in ~40
    // unrelated schemas (workspace/user/thumbnail chains) we don't use.
    BTDocumentInfo: [
        "thumbnail",
        "owner",
        "createdBy",
        "modifiedBy",
        "defaultWorkspace",
        "documentLabels",
        "permission",
        "recentVersion"
    ],
    BTGlobalTreeNodeInfo: ["owner", "createdBy", "modifiedBy"],
    BTGlobalTreeNodeSummaryInfo: [
        "defaultWorkspace",
        "documentLabels",
        "permission",
        "recentVersion",
        "thumbnail"
    ],
    // Same thumbnail/user-chain trim on the other included operations.
    BTVersionInfo: ["creator", "lastModifier", "thumbnail"],
    BTDocumentElementInfo: ["thumbnailInfo"]
};

export default defineConfig({
    input: "https://cad.onshape.com/api/openapi",
    output: "src/backend/onshape-api/onshape-types.gen",
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
                    "GET /assemblies/d/{did}/{wvm}/{wvmid}/e/{eid}"
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

                for (const [unionName, baseName] of UNIONS) {
                    const mapping = schemas[baseName]?.discriminator?.mapping;
                    if (mapping) {
                        schemas[unionName] = {
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
