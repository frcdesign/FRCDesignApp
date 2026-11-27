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
    replaced?: z.infer<typeof entitySchema>[];
}

const allOf = (
    entities: z.infer<typeof entitySchema>[],
    entityType: SelectedEntityType
) => entities.every((each) => each.entityType === entityType);

/** Faces with edges to exclude, circular edges alone, or screws alone, as Select by says. */
export function isConsistentPick(body: PickedEntities): boolean {
    const replaced = body.replaced ?? [];
    switch (body.selectionMode) {
        case SelectionMode.FACES:
            return (
                allOf(body.targets, SelectedEntityType.FACE) &&
                allOf(body.excluded, SelectedEntityType.EDGE) &&
                replaced.length === 0
            );
        case SelectionMode.LOCATIONS:
            return (
                allOf(body.targets, SelectedEntityType.EDGE) &&
                body.excluded.length === 0 &&
                replaced.length === 0
            );
        case SelectionMode.SCREWS:
            return body.targets.length === 0 && body.excluded.length === 0;
    }
}

export const INCONSISTENT_PICK_MESSAGE = "Select only what Select by asks for.";

/** A pick as the client keys its rows: its part's path and its id. */
export function pickKey(entity: {
    occurrencePath: string[];
    entityId: string;
}): string {
    return `${entity.occurrencePath.join("/")}|${entity.entityId}`;
}
