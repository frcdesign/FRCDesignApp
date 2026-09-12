import { InsertableOut } from "@backend/features/library/contract";
import { useShowHidden } from "../auth/access-level";

/** Narrower than `isVisible`: an editor still sees what is hidden. */
export function useIsInsertableHidden(insertable: InsertableOut): boolean {
    const showHidden = useShowHidden();
    return !insertable.isVisible && !showHidden;
}
