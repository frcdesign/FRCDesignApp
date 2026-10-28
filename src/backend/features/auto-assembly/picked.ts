/** Entities picked in an assembly, as a request carries them; Auto Assembly and insert and fasten both take them. */
import { z } from "zod";
import { SelectedEntityType, SelectionMode } from "./contract";
import { DETERMINISTIC_ID } from "./scan";

/** More than anyone picks by hand; each is scanned and fastened. */
export const MAX_SELECTIONS = 200;

export const entitySchema = z.object({
    occurrencePath: z.array(z.string().min(1)).min(1),
    entityId: z.string().regex(DETERMINISTIC_ID),
    entityType: z.enum(SelectedEntityType)
});

interface PickedEntities {
    selectionMode: SelectionMode;
    targets: z.infer<typeof entitySchema>[];
    excluded: z.infer<typeof entitySchema>[];
}

/** Faces with edges to skip, or circular edges alone. */
export function isConsistentPick(body: PickedEntities): boolean {
    return body.selectionMode === SelectionMode.FACES
        ? body.targets.every(
              (each) => each.entityType === SelectedEntityType.FACE
          ) &&
              body.excluded.every(
                  (each) => each.entityType === SelectedEntityType.EDGE
              )
        : body.targets.every(
              (each) => each.entityType === SelectedEntityType.EDGE
          ) && body.excluded.length === 0;
}

export const INCONSISTENT_PICK_MESSAGE =
    "Select either faces or circular edges to fasten to, not both.";
