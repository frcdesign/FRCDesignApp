import { PlusIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { type InsertableOut } from "@backend/features/library/contract";
import { UseSource } from "@backend/features/analytics/usage";
import { ElementType } from "@backend/lib/onshape/element-type";
import { RowActionButton } from "../../../components/row-action-button";
import { useUiState } from "../../../lib/ui-state";
import { m } from "../../../paraglide/messages";
import {
    useIsAssemblyInPartStudio,
    useTargetElementType
} from "../insert-hooks";
import { useInsertMutation } from "../queries";

interface QuickInsertButtonProps {
    insertable: InsertableOut;
    /** The configuration the row shows; the element's default without one. */
    selection?: PartialSelection;
    isFavorite: boolean;
    source: UseSource;
}

/**
 * A row's insert, as the insert menu's own button would make it, fastening
 * where that would. Nothing standalone, where there is nothing to insert into.
 */
export function QuickInsertButton(props: QuickInsertButtonProps): ReactNode {
    const { insertable, selection, isFavorite, source } = props;
    const targetElementType = useTargetElementType();
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );
    const fasten = useUiState((state) => state.fasten);
    const insertMutation = useInsertMutation(insertable, selection, {
        isFavorite,
        isQuickInsert: true,
        source
    });

    if (!targetElementType) {
        return null;
    }
    const isAssembly = targetElementType === ElementType.ASSEMBLY;
    return (
        <RowActionButton
            label={isAssembly ? m.insertQuickInsert() : m.insertQuickDerive()}
            icon={<PlusIcon />}
            loading={insertMutation.isPending}
            disabledReason={
                isAssemblyInPartStudio
                    ? m.insertCannotDeriveAssembly()
                    : undefined
            }
            onClick={() =>
                insertMutation.mutate(
                    isAssembly && insertable.supportsFasten && fasten
                )
            }
        />
    );
}
