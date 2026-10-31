import { Badge, Group, Stack, Text } from "@mantine/core";
import { ReactNode } from "react";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import { StatusColor } from "../../../lib/style-constants";
import {
    useInsertAsRigidMutation,
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
    useToggleSortOrderMutation
} from "../queries";
import { ControlRow, SectionHeader, SwitchRow } from "./sections";

interface InsertableSettingsProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** How an insertable is offered and inserted, and what its load found. */
export function InsertableSettings(props: InsertableSettingsProps): ReactNode {
    const { insertableId, status } = props;
    const isPartStudio = status.elementType === ElementType.PART_STUDIO;
    return (
        <Stack gap="sm">
            <SectionHeader>Settings</SectionHeader>
            <VisibilitySwitch
                insertableId={insertableId}
                isVisible={status.isVisible}
            />
            <FastenSwitch insertableId={insertableId} status={status} />
            {isPartStudio && (
                <RigidSwitch
                    insertableId={insertableId}
                    insertAsRigid={status.insertAsRigid}
                />
            )}
            <ControlRow
                label="Vendors"
                control={<VendorBadges vendors={status.vendors} />}
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
    status: InsertableBuildStatus;
}

/** A part studio decides by itself whether it has a connector to use. */
function FastenSwitch(props: FastenSwitchProps): ReactNode {
    const { insertableId, status } = props;
    const mutation = useToggleInsertAndFastenMutation(insertableId);
    const isPartStudio = status.elementType === ElementType.PART_STUDIO;
    return (
        <SwitchRow
            label="Insert and fasten"
            description={describeFasten(status)}
            checked={status.supportsFasten}
            disabled={
                mutation.isPending || (isPartStudio && !status.hasMateConnector)
            }
            onToggle={() => mutation.mutate(!status.supportsFasten)}
        />
    );
}

function describeFasten(status: InsertableBuildStatus): string {
    if (status.elementType !== ElementType.PART_STUDIO) {
        return "Fastens to its first mate connector";
    }
    if (!status.hasMateConnector) {
        return "No mate connector found";
    }
    if (status.fastenOverride === false) {
        return "Turned off; has a mate connector";
    }
    return "Placed and fastened at its first mate connector";
}

interface RigidSwitchProps {
    insertableId: string;
    insertAsRigid: boolean;
}

function RigidSwitch(props: RigidSwitchProps): ReactNode {
    const { insertableId, insertAsRigid } = props;
    const mutation = useInsertAsRigidMutation(insertableId);
    return (
        <SwitchRow
            label="Insert as rigid"
            description="Groups its parts in an assembly"
            checked={insertAsRigid}
            disabled={mutation.isPending}
            onToggle={() => mutation.mutate(!insertAsRigid)}
        />
    );
}

interface VendorBadgesProps {
    vendors: Vendor[];
}

function VendorBadges(props: VendorBadgesProps): ReactNode {
    const { vendors } = props;
    if (vendors.length === 0) {
        return <Text c={StatusColor.DIMMED}>None found</Text>;
    }
    return (
        <Group gap={4} wrap="wrap" justify="flex-end">
            {vendors.map((vendor) => (
                <Badge
                    key={vendor}
                    color={StatusColor.INFO}
                    title={getVendorName(vendor)}
                >
                    {vendor}
                </Badge>
            ))}
        </Group>
    );
}

interface GroupSettingsProps {
    groupId: string;
    status: GroupBuildStatus;
}

export function GroupSettings(props: GroupSettingsProps): ReactNode {
    const { groupId, status } = props;
    const mutation = useToggleSortOrderMutation(groupId);
    return (
        <Stack gap="sm">
            <SectionHeader>Settings</SectionHeader>
            <SwitchRow
                label="Sort alphabetically"
                description="Order elements A-Z instead of by tab"
                checked={status.sortAlphabetically}
                onToggle={() => mutation.mutate(!status.sortAlphabetically)}
            />
        </Stack>
    );
}
