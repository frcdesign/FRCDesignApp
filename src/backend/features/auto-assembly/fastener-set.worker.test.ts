import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { configurations } from "../../db/schema";
import {
    resetDb,
    seedGroup,
    seedInsertable,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID
} from "../../../__test_utils__";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { FASTENERS_MANIFEST } from "../../../__test_utils__/fasteners-manifest.gen";
import { releasedCatalog } from "../generated-parts/manifest";
import { generatedFeatures, saveGeneratedSet } from "../generated-parts/store";
import { getFastenerSet } from "./fastener-set";
import { FastenerKind } from "./studios";
import { MateLocation } from "../library/insertables/fasten";

const db = getDb(env.DB);

async function storeCatalog() {
    await saveGeneratedSet(db, {
        libraryId: TEST_LIBRARY_ID,
        set: "fasteners",
        groupId: TEST_GROUP_ID,
        versionId: "libv",
        // A released manifest names each studio's tab; the synced one, where it's released
        ...releasedCatalog({
            ...FASTENERS_MANIFEST,
            studios: Object.fromEntries(
                Object.entries(FASTENERS_MANIFEST.studios).map(
                    ([key, studio]) => [
                        key,
                        { ...studio, elementId: `${key}Studio`, records: [] }
                    ]
                )
            )
        })
    });
}

/** Each kind's tab, loaded as its generated studio, with its parameters. */
async function storeStudios(kinds = Object.values(FastenerKind)) {
    for (const kind of kinds) {
        const id = await seedInsertable(db, {
            id: `${kind}-row`,
            elementId: `${kind}Studio`,
            documentId: "lib",
            versionId: "libv",
            generatedStudio: `fasteners/${kind}`,
            fastenInfo: {
                mateConnectorId: `${kind}MC`,
                mateLocation: MateLocation.Feature,
                path: []
            }
        });
        await db.insert(configurations).values({
            insertableId: id,
            parameters: FASTENER_SET.studios[kind].parameters
        });
    }
}

beforeEach(async () => {
    await resetDb(db);
    await seedGroup(db);
});

describe("getFastenerSet", () => {
    it("reads the catalog a load stored and each kind's loaded studio", async () => {
        await storeCatalog();
        await storeStudios();
        expect(await getFastenerSet(db, TEST_LIBRARY_ID)).toEqual(FASTENER_SET);
    });

    it("is undefined until a load has stored the catalog and every studio", async () => {
        expect(await getFastenerSet(db, TEST_LIBRARY_ID)).toBeUndefined();
        await storeStudios();
        expect(await getFastenerSet(db, TEST_LIBRARY_ID)).toBeUndefined();
        await resetDb(db);
        await seedGroup(db);
        await storeCatalog();
        await storeStudios([FastenerKind.SCREW, FastenerKind.WASHER]);
        expect(await getFastenerSet(db, TEST_LIBRARY_ID)).toBeUndefined();
    });

    it("names every stored set's features, with the id each gives its mate connector", async () => {
        expect(await generatedFeatures(db)).toEqual([]);
        await storeCatalog();
        expect(
            (await generatedFeatures(db)).sort((a, b) =>
                a.type.localeCompare(b.type)
            )
        ).toEqual([
            { type: "fastenerNut", mateConnector: "mateConnector" },
            { type: "fastenerScrew", mateConnector: "mateConnector" },
            { type: "fastenerWasher", mateConnector: "mateConnector" }
        ]);
    });
});
