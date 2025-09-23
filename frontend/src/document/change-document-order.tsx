import { MenuItem } from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { DocumentOrder } from "../api/models";
import { useDocumentOrderQuery } from "../queries";
import { queryClient } from "../query-client";
import { ReactNode } from "react";
import { invalidateSearchDb } from "../api/search";

function useSetDocumentOrderMutation() {
    return useMutation({
        mutationKey: ["set-document-order"],
        mutationFn: async (documentOrder: DocumentOrder) => {
            return apiPost("/document-order", { body: { documentOrder } });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["document-order"] });
            invalidateSearchDb();
        }
    });
}

enum MoveOperation {
    MOVE_UP,
    MOVE_DOWN,
    MOVE_TO_TOP,
    MOVE_TO_BOTTOM
}

function applyMoveOperation(
    target: string,
    documentOrder: DocumentOrder,
    operation: MoveOperation
): DocumentOrder {
    const index = documentOrder.indexOf(target);
    if (index === -1) return documentOrder; // target not found, return unchanged

    // Make a shallow copy so we don't mutate input
    const result = [...documentOrder];

    switch (operation) {
        case MoveOperation.MOVE_UP: {
            if (index > 0) {
                [result[index - 1], result[index]] = [
                    result[index],
                    result[index - 1]
                ];
            }
            break;
        }
        case MoveOperation.MOVE_DOWN: {
            if (index < result.length - 1) {
                [result[index + 1], result[index]] = [
                    result[index],
                    result[index + 1]
                ];
            }
            break;
        }
        case MoveOperation.MOVE_TO_TOP: {
            result.splice(index, 1);
            result.unshift(target);
            break;
        }
        case MoveOperation.MOVE_TO_BOTTOM: {
            result.splice(index, 1);
            result.push(target);
            break;
        }
    }

    return result;
}

/**
 * Given a target and a documentOrder, returns a list of currently valid operations.
 */
function getValidOperations(
    target: string,
    documentOrder: DocumentOrder
): MoveOperation[] {
    const index = documentOrder.indexOf(target);
    if (index === -1) {
        return [];
    }
    const lastIndex = documentOrder.length - 1;
    const operations: MoveOperation[] = [];

    if (index > 0) {
        if (index === 1) {
            operations.push(MoveOperation.MOVE_UP); // only "up" since it goes straight to top
        } else {
            operations.push(MoveOperation.MOVE_UP, MoveOperation.MOVE_TO_TOP);
        }
    }

    if (index < lastIndex) {
        if (index === lastIndex - 1) {
            operations.push(MoveOperation.MOVE_DOWN); // only "down" since it goes straight to bottom
        } else {
            operations.push(
                MoveOperation.MOVE_DOWN,
                MoveOperation.MOVE_TO_BOTTOM
            );
        }
    }

    return operations;
}

interface ChangeDocumentOrderMenuProps {
    documentId: string;
}

/**
 * MenuItems that allow users to adjust the position of a document in the documents list.
 */

export function ChangeDocumentOrderItems(
    props: ChangeDocumentOrderMenuProps
): ReactNode {
    const { documentId } = props;

    const documentOrder = useDocumentOrderQuery().data ?? [];

    const operations = getValidOperations(documentId, documentOrder);
    const setDocumentOrderMutation = useSetDocumentOrderMutation();

    return (
        <>
            {operations.includes(MoveOperation.MOVE_UP) && (
                <MenuItem
                    icon="chevron-up"
                    text="Move up"
                    onClick={() => {
                        setDocumentOrderMutation.mutate(
                            applyMoveOperation(
                                documentId,
                                documentOrder,
                                MoveOperation.MOVE_UP
                            )
                        );
                    }}
                />
            )}
            {operations.includes(MoveOperation.MOVE_DOWN) && (
                <MenuItem
                    icon="chevron-down"
                    text="Move down"
                    onClick={() => {
                        setDocumentOrderMutation.mutate(
                            applyMoveOperation(
                                documentId,
                                documentOrder,
                                MoveOperation.MOVE_DOWN
                            )
                        );
                    }}
                />
            )}
            {operations.includes(MoveOperation.MOVE_TO_TOP) && (
                <MenuItem
                    icon="double-chevron-up"
                    text="Move to top"
                    onClick={() => {
                        setDocumentOrderMutation.mutate(
                            applyMoveOperation(
                                documentId,
                                documentOrder,
                                MoveOperation.MOVE_DOWN
                            )
                        );
                    }}
                />
            )}
            {operations.includes(MoveOperation.MOVE_TO_BOTTOM) && (
                <MenuItem
                    icon="double-chevron-down"
                    text="Move to bottom"
                    onClick={() => {
                        setDocumentOrderMutation.mutate(
                            applyMoveOperation(
                                documentId,
                                documentOrder,
                                MoveOperation.MOVE_TO_BOTTOM
                            )
                        );
                    }}
                />
            )}
        </>
    );
}
