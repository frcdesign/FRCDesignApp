import { type ReactNode, useMemo } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { type ElementPath } from "@backend/lib/onshape/path";
import { QueryList } from "../../../components/query-list";
import { SOLID_BODIES } from "../../../lib/messages";
import {
    isBody,
    type OnshapeSelection,
    selectionKey,
    toSelectedEntities
} from "../../../lib/selection";
import { StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { useLibraryQuery } from "../../library/queries";
import { EDIT_PARTS_LIST, setEditParts, useEditPicks } from "../edit-picks";
import { useEditCheck } from "../queries";
import { openEditMenu } from "../open-edit-menu";

interface EditPartsPickerProps {
    assembly: ElementPath;
    /** Stops selecting and closes the section. */
    onClose: () => void;
}

/** Under the context bar: the parts picked to edit, and the buttons to go on or give up. */
export function EditPartsPicker(props: EditPartsPickerProps): ReactNode {
    const { assembly, onClose } = props;
    const parts = useEditPicks((state) => state.parts);
    const library = useLibraryQuery();
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

    const problem = (entity: OnshapeSelection) =>
        problems.get(selectionKey(entity));

    return (
        <Stack gap="sm">
            <QueryList
                id={EDIT_PARTS_LIST}
                label={m.editPartsList()}
                prompt={m.editPartsPrompt()}
                entities={parts}
                onChange={setEditParts}
                accepts={isBody}
                filter={SOLID_BODIES}
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
            <Group gap="xs" justify="flex-end">
                <Button
                    size="compact-sm"
                    variant="default"
                    onClick={() => {
                        setEditParts([]);
                        onClose();
                    }}
                >
                    {m.contextBarCancel()}
                </Button>
                <Button
                    size="compact-sm"
                    disabled={!check || !insertable || isChecking}
                    onClick={() =>
                        check &&
                        insertable &&
                        openEditMenu({ assembly, insertable, parts, check })
                    }
                >
                    {m.editPartsEdit()}
                </Button>
            </Group>
        </Stack>
    );
}
