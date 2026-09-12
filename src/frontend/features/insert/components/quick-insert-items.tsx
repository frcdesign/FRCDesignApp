import { Menu } from "@mantine/core";
import { PlusIcon } from "@phosphor-icons/react";
import { ReactNode, useCallback } from "react";
import { useSearch } from "@tanstack/react-router";
import { InsertableOut } from "@backend/features/library/contract";
import { Selection } from "@backend/features/configurations/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { InsertSource } from "@backend/features/analytics/usage";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import { useIsAssemblyInPartStudio } from "../insert-hooks";
import { useInsertMutation } from "../queries";

interface QuickInsertItemsProps {
    insertable: InsertableOut;
    selection?: Selection;
    isFavorite: boolean;
    source: InsertSource;
}

/** Inserting straight from a row's menu, without opening the insert menu. */
export function QuickInsertItems(props: QuickInsertItemsProps): ReactNode {
    const { insertable, selection, isFavorite, source } = props;
    const search = useSearch({ from: "/app" });

    const insertMutation = useInsertMutation(insertable, selection, {
        isFavorite,
        isQuickInsert: true,
        source
    });
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    const handleClick = useCallback(
        (fasten: boolean) => {
            if (isAssemblyInPartStudio) {
                openCannotDeriveAssemblyAlert();
                return;
            }
            insertMutation.mutate(fasten);
        },
        [isAssemblyInPartStudio, insertMutation]
    );

    const supportsFasten =
        insertable.supportsFasten &&
        search.elementType === ElementType.ASSEMBLY;

    return (
        <>
            {supportsFasten && (
                <Menu.Item
                    color={StatusColor.INFO}
                    leftSection={<PlusIcon size={IconSize.SMALL} />}
                    onClick={() => handleClick(true)}
                >
                    Quick insert and fasten
                </Menu.Item>
            )}
            <Menu.Item
                color={StatusColor.INFO}
                leftSection={<PlusIcon size={IconSize.SMALL} />}
                onClick={() => handleClick(false)}
            >
                Quick insert
            </Menu.Item>
        </>
    );
}
