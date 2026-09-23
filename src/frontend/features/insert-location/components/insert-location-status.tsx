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

/**
 * Whether the assembly has somewhere to insert to, as a badged icon saying
 * which. Renders nowhere but an assembly the caller is signed in to: a derive
 * has no insert location, and the query needs a session.
 */
export function InsertLocationStatus(): ReactNode {
    const target = useInsertLocationTarget();
    const { data, isPending, isError } = useInsertLocationQuery(target);

    // Waiting rather than assuming: a badge that flips from a warning to a tick
    // on every open would read as the assembly having changed. A failed read
    // has not established there is none, so it says nothing at all.
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

    // The bubble shows the state alone: unlike the bar, it is already about
    // one thing, and its title says which.
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
            variant="light"
            leftSection={<PlusIcon size={IconSize.SMALL} />}
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
        >
            Add insert location
        </Button>
    );
}
