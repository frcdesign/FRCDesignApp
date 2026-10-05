import { ReactNode } from "react";
import { Button, Center, EmptyState, Group } from "@mantine/core";
import { PlusIcon, TargetIcon } from "@phosphor-icons/react";
import { type TargetElement } from "../../../lib/onshape-launch";
import { IconSize } from "../../../lib/style-constants";
import { BadgedIcon } from "../../../components/badged-icon";
import { StatusIcon } from "../../../components/status-icon";
import { Status } from "../../../lib/status";
import { AppHoverCard } from "../../../components/app-hover-card";
import { NewBadge, NewIndicator } from "../../../components/new-feature";
import { Hint } from "@backend/features/hints/contract";
import { useHasSeenHint } from "../../hints/queries";
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
    const hasAdded = useHasSeenHint(Hint.ADDED_INSERT_LOCATION);
    const found = instanceId !== undefined;
    const isNew = !found && !hasAdded;

    const status = found ? Status.SUCCESS : Status.WARNING;

    return (
        <AppHoverCard
            position="bottom-end"
            interactive
            target={
                <Center my="auto">
                    <NewIndicator shown={isNew} offset={2}>
                        <BadgedIcon icon={TargetIcon} status={status} />
                    </NewIndicator>
                </Center>
            }
        >
            <EmptyState
                align="left"
                size="sm"
                icon={<StatusIcon status={status} size={IconSize.CONTROL} />}
                title={
                    <Group gap="xs">
                        {found
                            ? "Insert location active"
                            : "No insert location found"}
                        {isNew && <NewBadge />}
                    </Group>
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
