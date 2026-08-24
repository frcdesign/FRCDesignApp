import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { Nut } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { AppTitle } from "../../../components/app-title";
import { SectionError } from "../../../components/app-zero-state";
import {
    BORDER,
    IconSize,
    PrimaryColor,
    SECTION_HEADER_HEIGHT
} from "../../../lib/style-constants";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { useBoltHelperMutation } from "../bolt-helper-hooks";
import { useCircularEdgeSelection } from "../edge-selection";

/** Fastens a mate to each circular edge picked in the Onshape window. */
export function BoltHelperPanel(): ReactNode {
    return (
        <>
            <Box
                px="md"
                h={SECTION_HEADER_HEIGHT}
                style={{ borderBottom: BORDER }}
            >
                <Group wrap="nowrap" h="100%">
                    <AppTitle
                        icon={
                            <Nut
                                size={IconSize.MEDIUM}
                                color={PrimaryColor.FILLED}
                            />
                        }
                        title="Bolt Helper"
                    />
                </Group>
            </Box>
            <Box style={{ borderBottom: BORDER }}>
                <BoltHelperContent />
            </Box>
        </>
    );
}

function BoltHelperContent(): ReactNode {
    const isConnected = useIsConnectedToOnshape();

    // The helper mates into the open tab, so there is nothing to run against.
    if (!isConnected) {
        return (
            <SectionError
                title="Not connected to a document"
                description="Open the app from an Onshape assembly to use the bolt helper."
            />
        );
    }
    return <EdgeSelectionForm />;
}

/** Mounted only when connected, since selection mode opens on mount. */
function EdgeSelectionForm(): ReactNode {
    const { edges, clear } = useCircularEdgeSelection();
    const boltHelper = useBoltHelperMutation();

    return (
        <Stack p="md" gap="sm" align="flex-start">
            <Text size="sm">
                Select circular edges in the Onshape window to mate to.
            </Text>
            <SelectedEdges count={edges.length} />
            <Group gap="xs">
                <Button
                    leftSection={<Nut size={IconSize.SMALL} />}
                    disabled={edges.length === 0}
                    loading={boltHelper.isPending}
                    onClick={() => boltHelper.mutate(edges)}
                >
                    Create fasten mates
                </Button>
                <Button
                    variant="subtle"
                    color="gray"
                    disabled={edges.length === 0}
                    onClick={clear}
                >
                    Clear
                </Button>
            </Group>
        </Stack>
    );
}

function SelectedEdges({ count }: { count: number }): ReactNode {
    return (
        <Text size="sm" c="dimmed">
            {count === 0
                ? "No edges selected."
                : `${count} edge${count === 1 ? "" : "s"} selected.`}
        </Text>
    );
}
