import { Stack, Switch, Tooltip } from "@mantine/core";
import { ReactNode } from "react";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    AUTO_INDEX_THRESHOLD,
    type ConfigurationCount,
    IndexingBand,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import { NO_SHRINK } from "../../../lib/style-constants";
import {
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
    useIndexConfigurationsMutation,
    useToggleSortOrderMutation
} from "../../library/card-hooks";
import { ControlRow, SectionHeader } from "./sections";
import { IssueIcon } from "./issues";

interface SwitchRowProps {
    label: string;
    description?: string;
    checked: boolean;
    onToggle: () => void;
}

/** A label (+ description) and on/off Switch row for an editable admin flag. */
function SwitchRow(props: SwitchRowProps): ReactNode {
    return (
        <ControlRow
            label={props.label}
            description={props.description}
            control={
                <Switch
                    size="sm"
                    checked={props.checked}
                    onChange={props.onToggle}
                    withThumbIndicator={false}
                />
            }
        />
    );
}

interface InsertableAdminSectionProps {
    insertableId: string;
    status: InsertableBuildStatus;
    configurationCount: ConfigurationCount;
}

/** The editable admin toggles for an insertable. */
export function InsertableAdminSection(
    props: InsertableAdminSectionProps
): ReactNode {
    const { insertableId, status, configurationCount } = props;
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
            <IndexingRow
                insertableId={insertableId}
                status={status}
                band={configurationCount.band}
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

interface IndexingRowProps {
    insertableId: string;
    status: InsertableBuildStatus;
    band: IndexingBand;
}

/**
 * A switch only where enabling indexing is the admin's call, an icon saying why
 * not otherwise — past the cap it can't run, under the threshold it already has.
 */
function IndexingRow(props: IndexingRowProps): ReactNode {
    const { insertableId, status, band } = props;
    const mutation = useIndexConfigurationsMutation(insertableId);

    let control: ReactNode;
    if (status.elementType === ElementType.ASSEMBLY) {
        control = (
            <IndexingIcon
                severity={null}
                tooltip="This part is an assembly, so metadata is pulled directly from the assembly tab."
            />
        );
    } else if (band === IndexingBand.EXCEEDED) {
        control = (
            <IndexingIcon
                severity={BuildIssueSeverity.ERROR}
                tooltip={`Parts with more than ${MAX_PART_NUMBER_CONFIGURATIONS} configurations are not eligible for indexing. To resolve, exclude configurations from affecting part properties in Onshape.`}
            />
        );
    } else if (band === IndexingBand.AUTOMATIC) {
        control = (
            <IndexingIcon
                severity={null}
                tooltip={`Indexed automatically: an insertable under ${AUTO_INDEX_THRESHOLD} configurations indexes on every load.`}
            />
        );
    } else {
        control = (
            <Switch
                size="sm"
                checked={status.indexConfigurations}
                onChange={() => mutation.mutate(!status.indexConfigurations)}
                withThumbIndicator={false}
            />
        );
    }

    return (
        <ControlRow
            label="Enable indexing"
            description="Index metadata for search"
            control={control}
        />
    );
}

interface IndexingIconProps {
    severity: BuildIssueSeverity | null;
    tooltip: string;
}

/**
 * Stands in for the switch where there is nothing to toggle, reusing the
 * build-check icons so the state reads the same as the callouts above it.
 */
function IndexingIcon(props: IndexingIconProps): ReactNode {
    const { severity, tooltip } = props;
    return (
        <Tooltip label={tooltip} withArrow multiline w={260}>
            <IssueIcon severity={severity} style={NO_SHRINK} />
        </Tooltip>
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
