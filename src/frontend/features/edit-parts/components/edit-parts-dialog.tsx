import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Text } from "@mantine/core";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { type EditCheckOut } from "@backend/features/edit-parts/contract";
import { type InsertableOut } from "@backend/features/library/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { MenuTitle } from "../../../components/app-title";
import { useAppModal } from "../../../components/open-app-modal";
import { QueryList } from "../../../components/query-list";
import { SOLID_BODIES } from "../../../lib/messages";
import {
    isBody,
    type OnshapeSelection,
    selectionKey,
    toSelectedEntities,
    useOnshapeSelection
} from "../../../lib/selection";
import { StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { useLibraryQuery } from "../../library/queries";
import { EDIT_PARTS_LIST, setEditParts, useEditPicks } from "../edit-picks";
import { useEditCheck } from "../queries";
import { EditMenuContent } from "./edit-menu";

interface EditPartsDialogProps {
    assembly: ElementPath;
}

/** What the configuration step edits, once the picks name a part. */
interface Chosen {
    insertable: InsertableOut;
    parts: OnshapeSelection[];
    check: EditCheckOut;
    applyToAll: boolean;
}

/** Picks the parts to edit, then shows the configuration menu for them. */
export function EditPartsDialog(props: EditPartsDialogProps): ReactNode {
    const { assembly } = props;
    const modal = useAppModal();
    const [chosen, setChosen] = useState<Chosen>();

    if (chosen) {
        return (
            <EditMenuContent
                assembly={assembly}
                {...chosen}
                onBack={() => {
                    modal.setTitle(m.editPartsTitle());
                    setChosen(undefined);
                }}
            />
        );
    }
    return (
        <PickParts
            assembly={assembly}
            onEdit={(next) => {
                modal.setTitle(<MenuTitle name={next.insertable.name} />);
                setChosen(next);
            }}
        />
    );
}

interface PickPartsProps {
    assembly: ElementPath;
    onEdit: (chosen: Chosen) => void;
}

function PickParts(props: PickPartsProps): ReactNode {
    const { assembly, onEdit } = props;
    const modal = useAppModal();
    const parts = useEditPicks((state) => state.parts);
    const library = useLibraryQuery();
    const [applyToAll, setApplyToAll] = useState(false);
    const checkBody = useMemo(
        () =>
            parts.length === 0
                ? undefined
                : { assembly, parts: toSelectedEntities(parts) },
        [assembly, parts]
    );
    const { check, problems, isChecking } = useEditCheck(checkBody);
    const insertable =
        check?.insertableId === undefined
            ? undefined
            : library.data?.insertables[check.insertableId];
    const isElsewhere = check?.insertableId !== undefined && !insertable;

    // Opened to pick: Onshape lets only whole parts be selected.
    useEffect(() => {
        useOnshapeSelection.getState().activate(EDIT_PARTS_LIST);
    }, []);

    const problem = (entity: OnshapeSelection) =>
        problems.get(selectionKey(entity));

    return (
        <>
            <AppModalBody>
                <QueryList
                    id={EDIT_PARTS_LIST}
                    label={m.editPartsList()}
                    entities={parts}
                    onChange={setEditParts}
                    accepts={isBody}
                    filter={SOLID_BODIES}
                    required
                    problem={problem}
                    isChecking={isChecking}
                    describe={(_entity, index) =>
                        m.editPartsRow({ index: index + 1 })
                    }
                />
                {isElsewhere && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {m.editPartsOtherLibrary()}
                    </Text>
                )}
                <Checkbox
                    label={m.editPartsApplyToAll()}
                    description={
                        check && check.matchingCount > 0
                            ? m.editPartsMatching({
                                  count: check.matchingCount
                              })
                            : undefined
                    }
                    checked={applyToAll}
                    onChange={(event) =>
                        setApplyToAll(event.currentTarget.checked)
                    }
                />
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={() => modal.close()}>
                    {m.contextBarCancel()}
                </Button>
                <Button
                    variant="filled"
                    rightSection={<ArrowRightIcon />}
                    disabled={!check || !insertable || isChecking}
                    onClick={() =>
                        check &&
                        insertable &&
                        onEdit({ insertable, parts, check, applyToAll })
                    }
                >
                    {m.editPartsEdit()}
                </Button>
            </AppModalFooter>
        </>
    );
}
