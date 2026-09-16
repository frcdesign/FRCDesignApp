import { ReactNode, useCallback } from "react";
import { Badge, Button, HoverCard, Stack, Text } from "@mantine/core";
import { CheckIcon, CrosshairSimpleIcon, XIcon } from "@phosphor-icons/react";
import { INSERT_LOCATION_NAME } from "@backend/features/insert-location/contract";
import { type TargetElement } from "../../../lib/onshape-launch";
import {
    sendHighlightMateConnectorMessage,
    sendStopRequestMessage
} from "../../../lib/messages";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import {
    useAddInsertLocationMutation,
    useInsertLocationQuery,
    useInsertLocationTarget
} from "../queries";

/**
 * Whether the assembly has somewhere to insert to, as a pill that lights the
 * connector up on hover. Renders nowhere but an assembly the caller is signed
 * in to: a derive has no insert location, and the query needs a session.
 */
export function InsertLocationPill(): ReactNode {
    const target = useInsertLocationTarget();
    const { data, isPending, isError } = useInsertLocationQuery(target);

    // Waiting rather than assuming: a pill that flips from a cross to a tick on
    // every open would read as the assembly having changed. A failed read has
    // not established there is no insert location, so it says nothing at all.
    if (!target || isPending || isError) {
        return null;
    }

    return (
        <InsertLocationHoverCard
            target={target}
            mateConnectorId={data?.mateConnectorId ?? null}
        />
    );
}

interface InsertLocationHoverCardProps {
    target: TargetElement;
    /** The connector to highlight, or null when the assembly has none. */
    mateConnectorId: string | null;
}

function InsertLocationHoverCard(
    props: InsertLocationHoverCardProps
): ReactNode {
    const { target, mateConnectorId } = props;
    const found = mateConnectorId !== null;

    const onOpen = useCallback(() => {
        if (mateConnectorId) {
            sendHighlightMateConnectorMessage(target, mateConnectorId);
        }
    }, [target, mateConnectorId]);

    const onClose = useCallback(() => {
        if (mateConnectorId) {
            sendStopRequestMessage(target);
        }
    }, [target, mateConnectorId]);

    return (
        <HoverCard
            shadow="md"
            position="bottom-end"
            withArrow
            onOpen={onOpen}
            onClose={onClose}
        >
            <HoverCard.Target>
                <Badge
                    variant="light"
                    color={found ? StatusColor.SUCCESS : StatusColor.NEUTRAL}
                    size="md"
                    my="auto"
                    leftSection={<CrosshairSimpleIcon size={IconSize.SMALL} />}
                    rightSection={
                        found ? (
                            <CheckIcon size={IconSize.SMALL} />
                        ) : (
                            <XIcon size={IconSize.SMALL} />
                        )
                    }
                    aria-label={
                        found ? "Insert location found" : "No insert location"
                    }
                />
            </HoverCard.Target>
            <HoverCard.Dropdown p="md">
                <Stack gap="sm" w={260}>
                    <Stack gap={4}>
                        <Text size="sm" fw={FontWeight.SEMI_BOLD}>
                            {found
                                ? "Insert location found"
                                : "No insert location found"}
                        </Text>
                        <Text size="sm" c={StatusColor.DIMMED}>
                            {found
                                ? `New parts will insert at the ${INSERT_LOCATION_NAME} mate connector.`
                                : "New parts will insert at the origin."}
                        </Text>
                    </Stack>
                    {!found && <AddInsertLocationButton target={target} />}
                </Stack>
            </HoverCard.Dropdown>
        </HoverCard>
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
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
        >
            Add insert location mate connector
        </Button>
    );
}
