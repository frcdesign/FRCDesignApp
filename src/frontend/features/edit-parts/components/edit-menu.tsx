import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@mantine/core";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import { type EditCheckOut } from "@backend/features/edit-parts/contract";
import {
    type PartialSelection,
    type Selection
} from "@backend/features/configurations/contract";
import { type InsertableOut } from "@backend/features/library/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { Callout } from "../../../components/callout";
import { useAppModal } from "../../../components/open-app-modal";
import {
    type OnshapeSelection,
    toSelectedEntities,
    useOnshapeSelection
} from "../../../lib/selection";
import { Status } from "../../../lib/status";
import { m } from "../../../paraglide/messages";
import { ConfigurationWrapper } from "../../insert/components/configurations";
import { setEditParts } from "../edit-picks";
import { useEditCheck, useEditPartsMutation } from "../queries";

export interface EditMenuContentProps {
    assembly: ElementPath;
    insertable: InsertableOut;
    parts: OnshapeSelection[];
    /** As the picks were checked: the first's configuration, and how many copies match. */
    check: EditCheckOut;
    /** Also every copy configured like a pick. */
    applyToAll: boolean;
}

/** The values of `selection` that differ from `from`. */
function changesOf(
    selection: PartialSelection,
    from: Selection
): PartialSelection {
    return Object.fromEntries(
        Object.entries(selection).filter(
            ([id, value]) => value !== undefined && from[id] !== value
        )
    );
}

/** The configuration menu for copies already in the assembly. */
export function EditMenuContent(props: EditMenuContentProps): ReactNode {
    const { assembly, insertable, parts, check, applyToAll } = props;
    const modal = useAppModal();
    const [selection, setSelection] = useState<PartialSelection | undefined>(
        check.selection
    );
    // Settled against the parameters, which the starting point is measured from.
    const [initial, setInitial] = useState<Selection>();
    const editMutation = useEditPartsMutation(insertable.name);

    const changes = useMemo(
        () => (initial && selection ? changesOf(selection, initial) : {}),
        [selection, initial]
    );
    const hasChanges = Object.keys(changes).length > 0;
    const entities = useMemo(() => toSelectedEntities(parts), [parts]);
    const checkBody = useMemo(
        () => (hasChanges ? { assembly, parts: entities, changes } : undefined),
        [assembly, entities, changes, hasChanges]
    );
    const { check: changed } = useEditCheck(checkBody);
    const stuck = changed?.problems.length ?? 0;
    const count = applyToAll ? check.matchingCount : check.pickedCount;

    const update = () => {
        editMutation.mutate(
            {
                assembly,
                parts: entities,
                changes,
                applyToAll
            },
            {
                onSuccess: () => {
                    setEditParts([]);
                    useOnshapeSelection.getState().finishSelecting();
                    modal.close();
                }
            }
        );
    };

    return (
        <>
            <AppModalBody>
                <Callout
                    status={Status.WARNING}
                    text={m.editPartsMatesWarning()}
                />
                {insertable.isConfigurable && (
                    <ConfigurationWrapper
                        insertableId={insertable.id}
                        microversionId={insertable.microversionId}
                        selection={selection}
                        setSelection={setSelection}
                        onReport={(report) =>
                            setInitial((current) => current ?? report.selection)
                        }
                    />
                )}
                {stuck > 0 && (
                    <Callout
                        status={Status.WARNING}
                        text={m.editPartsCannotChange({ count: stuck })}
                    />
                )}
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={() => modal.close()}>
                    {m.editPartsCancel()}
                </Button>
                <Button
                    variant="filled"
                    leftSection={<PencilSimpleIcon />}
                    disabled={!hasChanges}
                    loading={editMutation.isPending}
                    onClick={update}
                >
                    {m.editPartsUpdate({ count })}
                </Button>
            </AppModalFooter>
        </>
    );
}
