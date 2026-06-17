import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { insertables } from "../../shared/schema";
import { AccessLevel } from "../../shared/types";
import {
    TEST_ASSEMBLY_ID,
    TEST_PART_STUDIO_ID,
    MockOnshapeApi,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedPartStudio
} from "../../__test_utils__";
import { getDb } from "../db";

const db = getDb(env.DB);
const adminApp = () => createTestApp({ accessLevel: AccessLevel.ADMIN });

// The target element to insert into — must be an editable workspace ("w").
const target = "/d/doc-target/w/w-target/e/target-element";

describe("insertable routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("POST /toggle-open-composite toggles the flag (admin only)", async () => {
        await seedPartStudio(db);

        const res = await adminApp().request(
            `/api/toggle-open-composite/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { isOpenComposite: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, TEST_PART_STUDIO_ID))
            .get();
        expect(row?.isOpenComposite).toBe(true);
    });

    it("POST /toggle-open-composite is forbidden without admin access", async () => {
        await seedPartStudio(db);
        const res = await createTestApp().request(
            `/api/toggle-open-composite/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { isOpenComposite: true }),
            env
        );
        expect(res.status).toBe(403);
    });

    it("POST /toggle-insert-and-fasten can clear fasten support", async () => {
        await seedPartStudio(db);

        const res = await adminApp().request(
            `/api/toggle-insert-and-fasten/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { supportsFasten: false }),
            env
        );
        expect(res.status).toBe(200);

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, TEST_PART_STUDIO_ID))
            .get();
        expect(row?.supportsFasten).toBe(false);
        expect(row?.fastenInfo).toBeNull();
    });

    it("POST /add-to-part-studio inserts via the Onshape API", async () => {
        await seedPartStudio(db);
        const onshapeApi = new MockOnshapeApi().on("/partstudios/", {
            feature: { featureId: "feat-1" }
        });
        const app = createTestApp({ onshapeApi });

        const res = await app.request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}${target}`,
            jsonRequest("POST", {
                configuration: undefined,
                useMateConnector: false,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
        expect(res.status).toBe(200);

        const body: { featureId: string } = await res.json();
        expect(body.featureId).toBe("feat-1");
    });

    it("POST /add-to-assembly inserts via the Onshape API", async () => {
        await seedAssembly(db);
        const onshapeApi = new MockOnshapeApi().on("/assemblies/", {});
        const app = createTestApp({ onshapeApi });

        const res = await app.request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}${target}`,
            jsonRequest("POST", {
                configuration: undefined,
                fasten: false,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
        expect(res.status).toBe(200);

        const body: { featureId: string | null } = await res.json();
        expect(body.featureId).toBeNull();
    });
});
