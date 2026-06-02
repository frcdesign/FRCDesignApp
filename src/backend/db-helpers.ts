import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { type Db } from "./db";
import { insertables } from "../shared/schema";
import { type ElementPath } from "../shared/path";

/**
 * Returns the ElementPath for an insertable looked up by its ID.
 * Throws 404 if the insertable does not exist.
 * Insertable elements are always version-pinned (instanceType "v").
 */
export async function getInsertableElementPath(
    db: Db,
    insertableId: string
): Promise<ElementPath> {
    const row = await db
        .select({
            documentId: insertables.documentId,
            instanceId: insertables.instanceId,
            elementId: insertables.elementId
        })
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();

    if (!row) {
        throw new HTTPException(404, { message: "Insertable not found" });
    }

    return {
        documentId: row.documentId,
        instanceId: row.instanceId,
        instanceType: "v",
        elementId: row.elementId
    };
}
