import {
    type MassAssembly,
    MassNodeKind,
    type MassNode,
    type MassPart,
    type MassReportOut
} from "@backend/features/mass-analysis/contract";
import { colorVar } from "../../lib/style-constants";

export const POUNDS_PER_KILOGRAM = 1 / 0.45359237;

/** Kilograms, of every one the parent holds; a part with no mass adds nothing. */
export function totalMass(node: MassNode): number {
    if (node.kind === MassNodeKind.PART) {
        return (node.mass ?? 0) * node.quantity;
    }
    return node.quantity * sumMass(node.children);
}

export function sumMass(nodes: MassNode[]): number {
    return nodes.reduce((sum, node) => sum + totalMass(node), 0);
}

/** Whether a tile opens into its parts. */
export function canOpen(node: MassNode): node is MassAssembly {
    return node.kind === MassNodeKind.ASSEMBLY && !node.isLibrary;
}

export interface MassLevel {
    /** The subassemblies opened to reach it, outermost first. */
    trail: MassAssembly[];
    children: MassNode[];
}

/** As deep along `path`, by row id, as the report still goes. */
export function findLevel(report: MassReportOut, path: string[]): MassLevel {
    const trail: MassAssembly[] = [];
    let children = report.children;
    for (const id of path) {
        const next = children.find(
            (node): node is MassAssembly => node.id === id && canOpen(node)
        );
        if (!next) break;
        trail.push(next);
        children = next.children;
    }
    return { trail, children };
}

/** A treemap tile; its area is its share of the level's mass, in pounds. */
export interface MassTile {
    id: string;
    name: string;
    value: number;
    color: string;
}

/** Darkest first, so a lighter tile is always a lighter item. */
const SHADES = [9, 8, 7, 6, 5, 4, 3];

/** Massless items are left out: a zero-area tile still catches clicks. */
export function toTiles(children: MassNode[], hue: string): MassTile[] {
    return children
        .map((node) => ({ node, value: totalMass(node) * POUNDS_PER_KILOGRAM }))
        .filter(({ value }) => value > 0)
        .sort((a, b) => b.value - a.value)
        .map(({ node, value }, rank) => ({
            id: node.id,
            name: node.name,
            value,
            color: colorVar(hue, SHADES[Math.min(rank, SHADES.length - 1)])
        }));
}

/** A part with no mass, once however many times it's placed. */
export interface MissingPart {
    part: MassPart;
    /** How many the level holds, through every subassembly. */
    count: number;
    /** Every row's instances of it. */
    occurrences: string[][];
    /** The subassembly it's first found in, below the level; undefined at the level itself. */
    within?: string;
}

/** Every part below the level with no mass, but those inside a library's assembly. */
export function missingParts(children: MassNode[]): MissingPart[] {
    const found = new Map<string, MissingPart>();
    const visit = (
        nodes: MassNode[],
        multiplier: number,
        within: string | undefined
    ): void => {
        for (const node of nodes) {
            const count = node.quantity * multiplier;
            if (node.kind === MassNodeKind.ASSEMBLY) {
                if (!node.isLibrary) visit(node.children, count, node.name);
                continue;
            }
            if (node.mass !== undefined) continue;
            const existing = found.get(node.partKey);
            if (existing) {
                existing.count += count;
                existing.occurrences.push(...node.occurrences);
            } else {
                found.set(node.partKey, {
                    part: node,
                    count,
                    occurrences: [...node.occurrences],
                    within
                });
            }
        }
    };
    visit(children, 1, undefined);
    return [...found.values()];
}
