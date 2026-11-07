import { type ReactNode } from "react";
import { type InsertableOut } from "@backend/features/library/contract";
import { ChangesBadge } from "../../../components/changes-badge";
import { RequireAccessLevel } from "../../auth/components/require-access";
import { useDocumentChangesQuery } from "../queries";

interface GroupChangesBadgeProps {
    documentId: string;
}

/** The group's document's edits since its last version, in admin mode. */
export function GroupChangesBadge(props: GroupChangesBadgeProps): ReactNode {
    return (
        <RequireAccessLevel>
            <GroupChangesCount documentId={props.documentId} />
        </RequireAccessLevel>
    );
}

function GroupChangesCount(props: GroupChangesBadgeProps): ReactNode {
    const changesQuery = useDocumentChangesQuery(props.documentId, false);
    const changes = changesQuery.data?.changes;
    if (!changes) {
        return null;
    }
    return <ChangesBadge changes={changes} />;
}

interface InsertableChangesBadgeProps {
    insertable: InsertableOut;
}

/** Whether the part's tab was edited since the version the library holds, in admin mode. */
export function InsertableChangesBadge(
    props: InsertableChangesBadgeProps
): ReactNode {
    return (
        <RequireAccessLevel>
            <InsertableEdited insertable={props.insertable} />
        </RequireAccessLevel>
    );
}

function InsertableEdited(props: InsertableChangesBadgeProps): ReactNode {
    const { documentId, elementId, microversionId } = props.insertable;
    const changesQuery = useDocumentChangesQuery(documentId, true);
    const current = changesQuery.data?.elements?.[elementId];
    // A tab gone from the workspace is the next load's to report.
    if (!current || current === microversionId) {
        return null;
    }
    return <ChangesBadge />;
}
