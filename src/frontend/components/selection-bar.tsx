import { Button, Group, Paper, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { useOnshapeSelection } from "../lib/selection";
import { m } from "../paraglide/messages";

/**
 * Along the bottom of the panel while a query list limits what the Onshape
 * window lets be picked, with a button to stop.
 */
export function SelectionBar(): ReactNode {
    const isFiltering = useOnshapeSelection(
        (state) => state.filtering !== undefined
    );
    if (!isFiltering) {
        return null;
    }
    return (
        <Paper
            withBorder
            radius={0}
            px="md"
            py="xs"
            // Below the page however short it is, and in view however long
            style={{
                position: "sticky",
                bottom: 0,
                marginTop: "auto",
                zIndex: 1
            }}
        >
            <Group justify="space-between" gap="xs" wrap="nowrap">
                <Text size="sm">{m.selectionBarFiltered()}</Text>
                <Button
                    size="compact-sm"
                    onClick={() =>
                        useOnshapeSelection.getState().finishSelecting()
                    }
                >
                    {m.selectionBarFinish()}
                </Button>
            </Group>
        </Paper>
    );
}
