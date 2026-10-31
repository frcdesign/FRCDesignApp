import type { RecentInsert } from "@backend/features/recents/contract";
import type { SearchHit } from "../search/search";

/** The recents whose part a search hit, in the search's ranking; a part's own rows newest first. */
export function rankRecents(
    recents: RecentInsert[],
    hits: SearchHit[]
): RecentInsert[] {
    return hits.flatMap((hit) =>
        recents.filter((recent) => recent.insertableId === hit.id)
    );
}
