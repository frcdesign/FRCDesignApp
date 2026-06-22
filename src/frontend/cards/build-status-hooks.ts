import { useMemo } from "react";
import { ReactNode } from "react";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueType
} from "../../shared/build-checker";
import { GroupOut, InsertableOut } from "../../shared/api-models";
import { ElementType, getVendorName } from "../../shared/types";
import { useLibraryQuery } from "../queries";

/** A single label/value row shown in the "current state" section. */
export interface StateRow {
    label: string;
    value: ReactNode;
}

const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/** Builds the read-only "current state" rows shown for an insertable. */
export function getInsertableStateRows(insertable: InsertableOut): StateRow[] {
    const rows: StateRow[] = [
        { label: "Hidden", value: yesNo(!insertable.isVisible) }
    ];
    if (insertable.elementType === ElementType.PART_STUDIO) {
        rows.push({
            label: "Open composite",
            value: yesNo(insertable.isOpenComposite)
        });
    }
    rows.push({
        label: "Insert and fasten",
        value: yesNo(insertable.supportsFasten)
    });
    rows.push({
        label: "Vendors",
        value:
            insertable.vendors.length > 0
                ? insertable.vendors.map(getVendorName).join(", ")
                : "None"
    });
    return rows;
}

/** Builds the read-only "current state" rows shown for a group. */
export function getGroupStateRows(group: GroupOut): StateRow[] {
    return [
        {
            label: "Sort",
            value: group.sortAlphabetically ? "Alphabetical" : "Tab order"
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
