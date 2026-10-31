import { describe, expect, it } from "vitest";
import type { RecentInsert } from "@backend/features/recents/contract";
import type { SearchHit } from "../search/search";
import { rankRecents } from "./rank";

function recent(id: string, insertableId: string): RecentInsert {
    return { id, insertableId, insertedAt: 0 };
}

const hit = (id: string): SearchHit => ({ id, positions: [] });

describe("rankRecents", () => {
    // Newest first, as the list arrives.
    const recents = [
        recent("spacer-short", "spacer"),
        recent("gearbox", "gearbox"),
        recent("spacer-long", "spacer"),
        recent("bearing", "bearing")
    ];

    it("orders by the search's ranking, not by recency", () => {
        const ranked = rankRecents(recents, [hit("bearing"), hit("gearbox")]);
        expect(ranked.map((r) => r.id)).toEqual(["bearing", "gearbox"]);
    });

    it("keeps a part's own configurations newest first", () => {
        const ranked = rankRecents(recents, [hit("spacer"), hit("gearbox")]);
        expect(ranked.map((r) => r.id)).toEqual([
            "spacer-short",
            "spacer-long",
            "gearbox"
        ]);
    });

    it("leaves out what the search did not hit", () => {
        expect(rankRecents(recents, [])).toEqual([]);
    });
});
