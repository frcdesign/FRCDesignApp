import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates a committed *reference* dump of the Onshape API operations we use, at the
 * repo root in `onshape-api-reference/` — deliberately outside `src/`, so it's outside
 * every tsconfig's scope and never surfaces in editor autocomplete/auto-import alongside
 * our real, hand-authored `Onshape*` types.
 *
 * Run with `npm run gen:onshape-types`. NOTHING imports this output — the types we
 * actually use are hand-authored in `src/backend/onshape-api/onshape-types.ts` (so they
 * can use our own enums, comments, and clean discriminated unions). This generated dump
 * exists only as a reference: re-running codegen and diffing it surfaces upstream API
 * drift (including fields we don't currently use) to fold into the hand-written types.
 *
 * The upstream Onshape spec models polymorphism with `allOf` inheritance + a
 * `discriminator` on the base, which @hey-api does not expand into a `oneOf` union on
 * its own — a discriminator's concrete subtypes are unreachable by `$ref` and get pruned
 * by `orphans: false`. `UNION_BASES` lists discriminator base schema names: for each, we
 * add a *new* sibling schema (named mechanically via `unionName`, not hand-picked) that's
 * a `oneOf` of every member in the base's own `discriminator.mapping` (auto-derived, not
 * hand-listed), then repoint the handful of properties that reference the base
 * *polymorphically* (expecting any subtype) to point at the union instead. We
 * deliberately do NOT mutate the base schema itself in place — its subtypes still
 * `allOf`-extend it directly, and replacing the base with a union that contains its own
 * subtypes creates a circular type (`A = B | C`, `B = A & {...}`).
 *
 * `UNION_BASES` is deliberately short: some Onshape discriminators fan out to hundreds
 * of subtypes if you try to fully discriminate them (e.g. the FeatureScript feature-type
 * base behind `addAssemblyFeature`/`addPartStudioFeature`, which needs a fully
 * discriminated feature body to construct a request — those operations stay out of
 * `operations.include` below, not "reference" material). `getPartStudioFeatures` *is*
 * included despite sharing that same feature-type base (`BTMFeature-134`), because we
 * deliberately do NOT add it to `UNION_BASES` — its own flat fields (including the
 * recursive `subFeatures` and the plain `mateConnectorFeature` boolean) are all we need,
 * and skipping the union keeps its subtypes unreachable/pruned by `orphans: false`, so it
 * only costs its own small schema tree. `OMIT` trims fields that pull in large, unrelated
 * trees we don't use (thumbnail/owner/workspace chains) — note some fields are declared
 * both directly on a schema *and* re-declared on its `allOf` base(s), so both need an
 * entry to disappear.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// Mechanically derives a union schema's name from its discriminator base's own name
// (e.g. "BTMConfigurationParameter-819" -> "BTMConfigurationParameter819Union") — this
// is reference-only output, so there's no need to hand-pick a prettier name per base.
const unionName = (baseName: string) => `${baseName.replace(/-/g, "")}Union`;

// Discriminator base schemas to synthesize a `oneOf` union sibling for (see above).
const UNION_BASES: string[] = [
    "BTMConfigurationParameter-819",
    "BTParameterVisibilityCondition-177",
    "BTEnumOptionVisibilityCondition-3455",
    "BTGroupOrElementReference-2205"
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
                propsWith(schemas["BTElementGroup-1458"], "groups").groups.items =
                    ref(unionName("BTGroupOrElementReference-2205"));

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
