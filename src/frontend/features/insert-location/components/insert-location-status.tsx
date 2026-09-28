import { ReactNode } from "react";
import { Button, Center, EmptyState } from "@mantine/core";
import {
    CheckIcon,
    PlusIcon,
    TargetIcon,
    WarningIcon
} from "@phosphor-icons/react";
import { type TargetElement } from "../../../lib/onshape-launch";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { StatusIcon } from "../../../components/status-icon";
import { AppHoverCard } from "../../../components/app-hover-card";
import {
    useAddInsertLocationMutation,
    useInsertLocationQuery,
    useInsertLocationTarget
} from "../queries";

/** Only for an assembly the caller is signed in to. */
export function InsertLocationStatus(): ReactNode {
    const target = useInsertLocationTarget();
    const { data, isPending, isError } = useInsertLocationQuery(target);

    // Say nothing until known: a badge that flips on every open looks like a change.
    if (!target || isPending || isError) {
        return null;
    }

    return (
        <InsertLocationHoverCard
            target={target}
            instanceId={data?.instanceId}
        />
    );
}

interface InsertLocationHoverCardProps {
    target: TargetElement;
    /** The marker's instance, or nothing when the assembly has none. */
    instanceId?: string;
}

function InsertLocationHoverCard(
    props: InsertLocationHoverCardProps
): ReactNode {
    const { target, instanceId } = props;
    const found = instanceId !== undefined;

    const stateIcon = found ? CheckIcon : WarningIcon;
    const stateColor = found ? StatusColor.SUCCESS : StatusColor.WARNING;

    return (
        <AppHoverCard
            position="bottom-end"
            target={
                <Center my="auto">
                    <StatusIcon
                        icon={TargetIcon}
                        status={stateIcon}
                        color={stateColor}
                    />
                </Center>
            }
        >
            <EmptyState
                align="left"
                size="sm"
                icon={
                    <AppIcon
                        icon={stateIcon}
                        size={IconSize.CONTROL}
                        color={stateColor}
                    />
                }
                title={
                    found
                        ? "Insert location active"
                        : "No insert location found"
                }
                description={
                    found
                        ? "New parts will be placed at the insert location."
                        : "New parts will be placed at the origin."
                }
            >
                {!found && (
                    <EmptyState.Actions>
                        <AddInsertLocationButton target={target} />
                    </EmptyState.Actions>
                )}
            </EmptyState>
        </AppHoverCard>
    );
}

interface AddInsertLocationButtonProps {
    target: TargetElement;
}

function AddInsertLocationButton(
    props: AddInsertLocationButtonProps
): ReactNode {
    const { target } = props;
    const addMutation = useAddInsertLocationMutation(target);
    return (
        <Button
            size="compact-sm"
            leftSection={<PlusIcon />}
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
        >
            Add insert location
        </Button>
    );
}
