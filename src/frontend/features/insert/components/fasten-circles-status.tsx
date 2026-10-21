import { ReactNode } from "react";
import {
    Badge,
    Center,
    EmptyState,
    Group,
    Paper,
    Stack,
    Text
} from "@mantine/core";
import { CircleDashedIcon } from "@phosphor-icons/react";
import {
    type CircleSelection,
    MAX_FASTEN_CIRCLES
} from "@backend/features/library/contract";
import { Hint } from "@backend/features/hints/contract";
import { AppHoverCard } from "../../../components/app-hover-card";
import { BadgedIcon } from "../../../components/badged-icon";
import { StatusIcon } from "../../../components/status-icon";
import { InfoCheckbox } from "../../../components/info-checkbox";
import { NewBadge, NewIndicator } from "../../../components/new-feature";
import { Status } from "../../../lib/status";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { plural } from "../../../lib/plural";
import { updateUiState, useUiState } from "../../../lib/ui-state";
import { useHasSeenHint } from "../../hints/queries";
import {
    CIRCLE_FIELD_ATTRIBUTE,
    setSelectingCircles,
    useCircleSelectionRequest,
    useIsSelectingCircles,
    useSelectedCircles
} from "../circle-selection";

/** For an insert that will fasten: the circles it will fasten to, and where to pick more. */
export function FastenCirclesStatus(): ReactNode {
    const circles = useSelectedCircles();
    const isSelecting = useIsSelectingCircles();
    const replicate = useUiState((state) => state.replicate);
    const hasFastened = useHasSeenHint(Hint.FASTENED_TO_CIRCLES);
    useCircleSelectionRequest();

    const found = circles.length > 0;
    const isNew = !found && !hasFastened;
    const status = getCirclesStatus(circles.length);
    const canReplicate = circles.length > 1;

    return (
        <AppHoverCard
            position="bottom-end"
            interactive
            target={
                <Center my="auto">
                    <NewIndicator shown={isNew} offset={2}>
                        <BadgedIcon
                            icon={CircleDashedIcon}
                            status={status}
                            // Still selecting after the card closes.
                            color={
                                isSelecting ? PrimaryColor.FILLED : undefined
                            }
                        />
                    </NewIndicator>
                </Center>
            }
        >
            <Stack gap="sm" maw={300}>
                <EmptyState
                    align="left"
                    size="sm"
                    icon={
                        <StatusIcon status={status} size={IconSize.CONTROL} />
                    }
                    title={
                        <Group gap="xs">
                            {found
                                ? `${plural(circles.length, "circle")} selected`
                                : "No circles selected"}
                            {isNew && <NewBadge />}
                        </Group>
                    }
                    description={describeFasten(
                        circles.length,
                        canReplicate && replicate
                    )}
                />
                <CircleSelectionField
                    circles={circles}
                    isSelecting={isSelecting}
                />
                {canReplicate && (
                    <InfoCheckbox
                        label="Replicate"
                        info="Insert one part and replicate it onto the other circles, rather than inserting a part for each."
                        checked={replicate}
                        onChange={(checked) =>
                            updateUiState({ replicate: checked })
                        }
                    />
                )}
            </Stack>
        </AppHoverCard>
    );
}

function getCirclesStatus(count: number): Status {
    if (count > MAX_FASTEN_CIRCLES) {
        return Status.WARNING;
    }
    return count > 0 ? Status.SUCCESS : Status.INFO;
}

function describeFasten(count: number, replicate: boolean): string {
    if (count > MAX_FASTEN_CIRCLES) {
        return `At most ${MAX_FASTEN_CIRCLES} circles can be fastened to at once; deselect some in Onshape.`;
    }
    if (count === 0) {
        return "Select circles in Onshape to fasten the part to them, or finish the fasten mate after inserting.";
    }
    if (count === 1) {
        return "The part will be fastened to the selected circle.";
    }
    return replicate
        ? "The part will be fastened to the first circle and replicated onto the rest."
        : "A part will be inserted and fastened to each selected circle.";
}

interface CircleSelectionFieldProps {
    circles: CircleSelection[];
    isSelecting: boolean;
}

/** Like an Onshape query field: click it, then pick circles in the Onshape window. */
function CircleSelectionField(props: CircleSelectionFieldProps): ReactNode {
    const { circles, isSelecting } = props;
    return (
        <Paper
            {...{ [CIRCLE_FIELD_ATTRIBUTE]: true }}
            withBorder
            p="xs"
            style={{
                cursor: "pointer",
                borderColor: isSelecting ? PrimaryColor.FILLED : undefined
            }}
            onClick={() => setSelectingCircles(!isSelecting)}
        >
            {circles.length === 0 ? (
                <Text size="sm" c="dimmed">
                    {isSelecting
                        ? "Select circles in Onshape"
                        : "Click to select circles"}
                </Text>
            ) : (
                <Group gap={4}>
                    {circles.map((circle, index) => (
                        <Badge
                            key={`${circle.occurrencePath.join("/")}:${circle.selectionId}`}
                            variant="light"
                        >
                            Circle {index + 1}
                        </Badge>
                    ))}
                </Group>
            )}
        </Paper>
    );
}
