import { Stack } from "@mantine/core";
import { ReactNode } from "react";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import {
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
    useToggleSortOrderMutation
} from "../queries";
import { SectionHeader, SwitchRow } from "./sections";

interface InsertableAdminSectionProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** The editable admin toggles for an insertable. */
export function InsertableAdminSection(
    props: InsertableAdminSectionProps
): ReactNode {
    const { insertableId, status } = props;
    return (
        <Stack gap="sm">
            <SectionHeader>Admin</SectionHeader>
            <VisibilitySwitch
                insertableId={insertableId}
                isVisible={status.isVisible}
            />
            <FastenSwitch
                insertableId={insertableId}
                supportsFasten={status.supportsFasten}
            />
        </Stack>
    );
}

interface VisibilitySwitchProps {
    insertableId: string;
    isVisible: boolean;
}

function VisibilitySwitch(props: VisibilitySwitchProps): ReactNode {
    const { insertableId, isVisible } = props;
    const mutation = useSetVisibilityMutation([insertableId], !isVisible);
    return (
        <SwitchRow
            label="Visible to users"
            checked={isVisible}
            onToggle={() => mutation.mutate()}
        />
    );
}

interface FastenSwitchProps {
    insertableId: string;
    supportsFasten: boolean;
}

function FastenSwitch(props: FastenSwitchProps): ReactNode {
    const { insertableId, supportsFasten } = props;
    const mutation = useToggleInsertAndFastenMutation(insertableId);
    return (
        <SwitchRow
            label="Insert and fasten"
            description="Allows mate-on-insert"
            checked={supportsFasten}
            onToggle={() => mutation.mutate(!supportsFasten)}
        />
    );
}

interface GroupAdminSectionProps {
    groupId: string;
    status: GroupBuildStatus;
}

/** The editable admin toggles for a group. */
export function GroupAdminSection(props: GroupAdminSectionProps): ReactNode {
    const { groupId, status } = props;
    const mutation = useToggleSortOrderMutation(groupId);
    return (
        <Stack gap="sm">
            <SectionHeader>Admin</SectionHeader>
            <SwitchRow
                label="Sort alphabetically"
                description="Order elements A-Z instead of by tab"
                checked={status.sortAlphabetically}
                onToggle={() => mutation.mutate(!status.sortAlphabetically)}
            />
        </Stack>
    );
}
