import type {
    OnshapeBom,
    OnshapeBomHeader,
    OnshapeBomRow
} from "../../lib/onshape/types";
import {
    type MassAssembly,
    MassNodeKind,
    type MassReportOut
} from "./contract";

/** Kilograms in one of each unit Onshape may write a mass in. */
const KILOGRAMS_PER_UNIT: Record<string, number> = {
    kg: 1,
    kilogram: 1,
    kilograms: 1,
    g: 0.001,
    gram: 0.001,
    grams: 0.001,
    lb: 0.45359237,
    lbm: 0.45359237,
    lbs: 0.45359237,
    pound: 0.45359237,
    pounds: 0.45359237,
    oz: 0.028349523125,
    ounce: 0.028349523125,
    ounces: 0.028349523125
};

/** The cell shapes are undocumented, so each takes a number, a string with units, or an object holding either. */
export function parseMass(value: unknown): number | undefined {
    if (typeof value === "number") {
        return value > 0 ? value : undefined;
    }
    if (typeof value === "string") {
        const match = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z]*)/i.exec(value);
        if (!match) return undefined;
        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();
        const scale = unit === "" ? 1 : KILOGRAMS_PER_UNIT[unit];
        if (!Number.isFinite(amount) || scale === undefined) return undefined;
        return amount > 0 ? amount * scale : undefined;
    }
    if (typeof value === "object" && value !== null) {
        const object = value as Record<string, unknown>;
        const unit = object.unit ?? object.units;
        if (typeof object.value === "number" && typeof unit === "string") {
            return parseMass(`${object.value} ${unit}`);
        }
        return parseMass(object.value);
    }
    return undefined;
}

function parseText(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value.trim() === "" ? undefined : value;
    }
    if (typeof value === "object" && value !== null) {
        const object = value as Record<string, unknown>;
        return parseText(object.displayName ?? object.name ?? object.value);
    }
    return undefined;
}

function parseQuantity(value: unknown): number {
    const quantity = typeof value === "string" ? Number(value) : value;
    return typeof quantity === "number" && quantity > 0 ? quantity : 1;
}

interface Columns {
    name?: string;
    quantity?: string;
    mass?: string;
}

/** Picked out by name, as the metadata's properties are; "Mass override" is its own column. */
function findColumns(headers: OnshapeBomHeader[]): Columns {
    const columns: Columns = {};
    for (const header of headers) {
        const name = (header.name ?? "").trim().toLowerCase();
        const property = (header.propertyName ?? "").toLowerCase();
        if (name === "name" || property === "name") {
            columns.name ??= header.id;
        } else if (name === "quantity" || property === "quantity") {
            columns.quantity ??= header.id;
        } else if (name === "mass" || property === "mass") {
            columns.mass ??= header.id;
        }
    }
    return columns;
}

function cell(row: OnshapeBomRow, header: string | undefined): unknown {
    return header === undefined ? undefined : row.headerIdToValue?.[header];
}

interface BomItem {
    documentId: string;
    partId: string;
    /** The same Part Studio, part and configuration wherever it's placed. */
    partKey: string;
}

function toItem(row: OnshapeBomRow): BomItem | undefined {
    const source = row.itemSource;
    if (!source?.documentId || !source.elementId) {
        return undefined;
    }
    const partId = source.partId ?? "";
    return {
        documentId: source.documentId,
        partId,
        partKey: [
            source.documentId,
            source.wvmId ?? "",
            source.elementId,
            partId,
            source.configuration ?? ""
        ].join("|")
    };
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((each) => typeof each === "string")
    );
}

/** Undocumented: each is taken as a path of instance ids, joined by `/` or as an array. */
export function parseOccurrences(value: unknown): string[][] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((occurrence: unknown) => {
        if (typeof occurrence === "string") {
            const path = occurrence.split("/").filter((id) => id !== "");
            return path.length > 0 ? [path] : [];
        }
        if (isStringArray(occurrence) && occurrence.length > 0) {
            return [occurrence];
        }
        const path = (occurrence as { path?: unknown } | null)?.path;
        return isStringArray(path) && path.length > 0 ? [path] : [];
    });
}

/**
 * The BOM's rows as a tree. A row is a subassembly when the row after it is
 * deeper, or it names no part; one added by hand has no geometry and is left
 * out. A subassembly is a library's when it, or one it's in, is from one of
 * `libraryDocumentIds`.
 */
export function toMassReport(
    bom: OnshapeBom,
    libraryDocumentIds: ReadonlySet<string>
): MassReportOut {
    const columns = findColumns(bom.headers ?? []);
    const rows = bom.rows ?? [];
    const root: MassAssembly = {
        kind: MassNodeKind.ASSEMBLY,
        id: "",
        name: "",
        quantity: 1,
        isLibrary: false,
        children: []
    };
    // The open subassemblies, outermost first, each at the depth of its children.
    const stack: { depth: number; node: MassAssembly }[] = [
        { depth: 0, node: root }
    ];

    rows.forEach((row, index) => {
        const depth = row.indentLevel ?? 0;
        while (stack.length > 1 && stack[stack.length - 1].depth > depth) {
            stack.pop();
        }
        const item = toItem(row);
        if (row.itemSource?.nonGeometricItemId || !item) {
            return;
        }
        const id = row.rowId ?? row.id ?? String(index);
        const name =
            parseText(cell(row, columns.name)) ??
            row.name ??
            (item.partId || id);
        const quantity = parseQuantity(cell(row, columns.quantity));
        const nextDepth = rows[index + 1]?.indentLevel ?? 0;
        const isAssembly = nextDepth > depth || item.partId === "";
        const parent = stack[stack.length - 1].node;

        if (isAssembly) {
            const assembly: MassAssembly = {
                kind: MassNodeKind.ASSEMBLY,
                id,
                name,
                quantity,
                isLibrary:
                    parent.isLibrary || libraryDocumentIds.has(item.documentId),
                children: []
            };
            parent.children.push(assembly);
            stack.push({ depth: depth + 1, node: assembly });
            return;
        }
        parent.children.push({
            kind: MassNodeKind.PART,
            id,
            name,
            quantity,
            mass: parseMass(cell(row, columns.mass)),
            partKey: item.partKey,
            occurrences: parseOccurrences(row.relatedOccurrences)
        });
    });

    return { children: root.children };
}
