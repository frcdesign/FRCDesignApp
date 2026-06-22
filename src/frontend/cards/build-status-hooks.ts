import { useMemo } from "react";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueType
} from "../../shared/build-checker";
import { GroupOut, InsertableOut } from "../../shared/api-models";
import { ElementType, Vendor } from "../../shared/types";
import { useLibraryQuery } from "../queries";

/**
 * The value of a "current state" row. A discriminated union so the build-status
 * component can render each kind appropriately (a check/cross for booleans, a
 * set of badges for vendors) while this file stays free of JSX.
 */
export type StateRowValue =
    | { kind: "bool"; value: boolean }
    | { kind: "vendors"; vendors: Vendor[] };

/** A single label/value row shown in the "current state" section. */
export interface StateRow {
    label: string;
    value: StateRowValue;
}

/** Builds the read-only "current state" rows shown for an insertable. */
export function getInsertableStateRows(insertable: InsertableOut): StateRow[] {
    const rows: StateRow[] = [
        {
            label: "Hidden",
            value: { kind: "bool", value: !insertable.isVisible }
        }
    ];
    if (insertable.elementType === ElementType.PART_STUDIO) {
        rows.push({
            label: "Open composite",
            value: { kind: "bool", value: insertable.isOpenComposite }
        });
    }
    rows.push({
        label: "Insert and fasten",
        value: { kind: "bool", value: insertable.supportsFasten }
    });
    rows.push({
        label: "Vendors",
        value: { kind: "vendors", vendors: insertable.vendors }
    });
    return rows;
}

/** Builds the read-only "current state" rows shown for a group. */
export function getGroupStateRows(group: GroupOut): StateRow[] {
    return [
        {
            label: "Sort alphabetically",
            value: { kind: "bool", value: group.sortAlphabetically }
        }
    ];
}

/**
 * Returns the build issues for an insertable. Currently just the stored
 * build-time issues; a thin accessor so live checks can be added later.
 */
export function getInsertableBuildIssues(
    insertable: InsertableOut
): BuildIssue[] {
    return insertable.buildIssues;
}

/**
 * Returns the build issues for a group, combining stored build-time issues with
 * the live "no unhidden insertables" check (computed here since visibility is
 * user-dependent).
 */
export function useGroupBuildIssues(group: GroupOut): BuildIssue[] {
    const insertables = useLibraryQuery().data?.insertables;
    return useMemo(() => {
        const hasUnhidden = group.insertableOrder.some(
            (id) => insertables?.[id]?.isVisible
        );
        if (hasUnhidden) {
            return group.buildIssues;
        }
        return addBuildIssue(group.buildIssues, {
            type: BuildIssueType.NoUnhiddenInsertables
        });
    }, [group.buildIssues, group.insertableOrder, insertables]);
}
