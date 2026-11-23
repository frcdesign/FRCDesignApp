import { type ReactNode, useMemo, useState } from "react";
import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { FastenerKind } from "@backend/features/auto-assembly/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import { QueryList } from "../../../components/query-list";
import { SOLID_BODIES } from "../../../lib/messages";
import {
    isBody,
    type OnshapeSelection,
    selectionKey,
    toSelectedEntities
} from "../../../lib/selection";
import { UtilityTab } from "../../../lib/app-tab";
import { StatusColor } from "../../../lib/style-constants";
import { useNavigateToTab } from "../../../lib/tabs";
import { m } from "../../../paraglide/messages";
import { useAutoAssemblyStore } from "../../auto-assembly/store";
import { useLibraryQuery } from "../../library/queries";
import { EDIT_PARTS_LIST, setEditParts, useEditPicks } from "../edit-picks";
import { openEditMenu } from "../open-edit-menu";
import { useEditCheck } from "../queries";

interface EditPartsPickerProps {
    assembly: ElementPath;
    /** Clears the picks and closes the section. */
    onCancel: () => void;
}

/** Under the context bar: the part to edit, whether to take every copy configured the same, and Edit. */
export function EditPartsPicker(props: EditPartsPickerProps): ReactNode {
    const { assembly, onCancel } = props;
    const parts = useEditPicks((state) => state.parts);
    const library = useLibraryQuery();
    const navigateToTab = useNavigateToTab();
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
    // A screw is edited with its washers and nut, in Auto Assembly
    const isScrew = check?.fastener === FastenerKind.SCREW;
    const isElsewhere =
        !isScrew && check?.insertableId !== undefined && !insertable;

    const problem = (entity: OnshapeSelection) =>
        problems.get(selectionKey(entity));

    const edit = () => {
        if (isScrew) {
            useAutoAssemblyStore.getState().updateScrew(parts[0]);
            setEditParts([]);
            navigateToTab(UtilityTab.AUTO_ASSEMBLY);
        } else if (check && insertable) {
            openEditMenu({ assembly, insertable, parts, check, applyToAll });
        }
    };

    return (
        <Stack gap="sm">
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
                describe={() => m.editPartsRow()}
            />
            {isElsewhere && (
                <Text size="xs" c={StatusColor.DIMMED}>
                    {m.editPartsOtherLibrary()}
                </Text>
            )}
            {!isScrew && (
                <Checkbox
                    label={m.editPartsApplyToAll()}
                    checked={applyToAll}
                    onChange={(event) =>
                        setApplyToAll(event.currentTarget.checked)
                    }
                />
            )}
            <Group gap="xs" justify="flex-end">
                <Button size="compact-sm" variant="default" onClick={onCancel}>
                    {m.contextBarCancel()}
                </Button>
                <Button
                    size="compact-sm"
                    rightSection={<ArrowRightIcon />}
                    disabled={!check || (!insertable && !isScrew) || isChecking}
                    onClick={edit}
                >
                    {m.editPartsEdit()}
                </Button>
            </Group>
        </Stack>
    );
}
