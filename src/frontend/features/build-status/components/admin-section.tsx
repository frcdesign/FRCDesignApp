import { Badge, Group, Stack, Text } from "@mantine/core";
import { ReactNode } from "react";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import { StatusColor } from "../../../lib/style-constants";
import {
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
    useToggleSortOrderMutation
} from "../queries";
import { SwitchRow } from "./sections";
import { HoverBubbleRow } from "../../../components/app-hover-bubble";

interface InsertableSettingsProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** How an insertable is offered and inserted, and what its load found. */
export function InsertableSettings(props: InsertableSettingsProps): ReactNode {
    const { insertableId, status } = props;
    return (
        <Stack gap="sm">
            <VisibilitySwitch
                insertableId={insertableId}
                isVisible={status.isVisible}
            />
            <FastenSwitch insertableId={insertableId} status={status} />
            <HoverBubbleRow label="Vendors">
                <VendorBadges vendors={status.vendors} />
            </HoverBubbleRow>
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

/** On wherever a load finds a connector, so the switch only turns it off or back on. */
function FastenSwitch(props: FastenSwitchProps): ReactNode {
    const { insertableId, status } = props;
    const mutation = useToggleInsertAndFastenMutation(insertableId);
    const noConnector = !status.supportsFasten && !status.fastenDisabled;
    return (
        <SwitchRow
            label="Insert and fasten"
            description={
                noConnector
                    ? "No mate connector found"
                    : "Places and fastens at its first mate connector"
            }
            checked={status.supportsFasten}
            disabled={mutation.isPending || noConnector}
            onToggle={() => mutation.mutate(!status.supportsFasten)}
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
            <SwitchRow
                label="Sort alphabetically"
                description="Order elements A-Z instead of by tab"
                checked={status.sortAlphabetically}
                onToggle={() => mutation.mutate(!status.sortAlphabetically)}
            />
        </Stack>
    );
}
