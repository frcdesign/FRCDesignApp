import { describe, expect, it } from "vitest";
import type { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { type ListRow, searchList } from "./list-search";

function insertable(id: string, name: string): InsertableOut {
    return {
        id,
        elementId: id,
        groupId: "g",
        documentId: "d",
        versionId: "v",
        path: {
            documentId: "d",
            instanceType: "v",
            instanceId: "v",
            elementId: id
        },
        name,
        microversionId: "mv",
        isVisible: true,
        supportsFasten: false,
        elementType: ElementType.PART_STUDIO,
        isConfigurable: true,
        vendors: []
    };
}

function row(id: string, part: InsertableOut, partNumber?: string): ListRow {
    return {
        id,
        insertable: part,
        groupName: "Spacers",
        record: partNumber
            ? { partNumber, values: {}, configurationKey: "" }
            : undefined
    };
}

const spacer = insertable("spacer", "Hex Spacer");
const bearing = insertable("bearing", "Flanged Bearing");

const rows = [
    row("spacer-short", spacer, "AM-0716"),
    row("spacer-long", spacer, "WCP-0516"),
    row("bearing", bearing, "217-3000")
];

const ids = (query: string) => searchList(rows, query).map(({ row }) => row.id);

describe("searchList", () => {
    it("finds a row by its own configuration's part number", () => {
        expect(ids("WCP-0516")).toEqual(["spacer-long"]);
    });

    it("never finds a row by another configuration's part number", () => {
        expect(ids("AM-0716")).toEqual(["spacer-short"]);
    });

    // As the library search does: a number's pieces match too, ranked below it.
    it("ranks the exact part number above one sharing a piece of it", () => {
        const both = [...rows, row("spacer-wide", spacer, "WCP-0999")];
        const found = searchList(both, "WCP-0516").map(({ row }) => row.id);
        expect(found).toEqual(["spacer-long", "spacer-wide"]);
    });

    it("finds every row of a part by its name", () => {
        expect(ids("hex").sort()).toEqual(["spacer-long", "spacer-short"]);
    });

    it("ranks a closer match first", () => {
        expect(ids("bearing")[0]).toBe("bearing");
    });

    it("underlines the matched part number", () => {
        const [{ hit }] = searchList(rows, "217-3000");
        expect(hit.partNumber).toBe("217-3000");
        expect(hit.partNumberPositions).toContainEqual({ start: 0, length: 8 });
    });
});
