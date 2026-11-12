import { type ReactNode, useState } from "react";
import { Badge, Box, Button, Collapse, Group, Text } from "@mantine/core";
import { CursorClickIcon, PlusIcon, TargetIcon } from "@phosphor-icons/react";
import { useIsSignedIn } from "../features/auth/access-level";
import {
    type InsertLocation,
    useAddInsertLocationMutation,
    useInsertLocation
} from "../features/insert-location/queries";
import { FastenPicks } from "../features/insert/components/fasten-section";
import {
    clearFastenPicks,
    FASTEN_TARGETS_LIST,
    useFastenPicks
} from "../features/insert/fasten-picks";
import { useTargetAssembly } from "../lib/onshape-params";
import { listLabel, useOnshapeSelection } from "../lib/selection";
import { IconSize, PrimaryColor } from "../lib/style-constants";
import { useUiState } from "../lib/ui-state";
import { m } from "../paraglide/messages";
import styles from "../lib/styles.module.css";
import { AppIcon } from "./app-icon";
import { ParameterGrid } from "./parameter-input";

const BAR_HEIGHT = 40;

interface ContextBarProps {
    /** Inserting is a library page's; a utility's page places nothing from a row. */
    isLibrary: boolean;
}

/**
 * The header's last row. On a library page in an assembly, the actions that
 * work with the Onshape window: each opens its query lists under the bar and
 * starts selecting. On any other page, which query list limits picks, with
 * the button to stop.
 */
export function ContextBar(props: ContextBarProps): ReactNode {
    return props.isLibrary ? <LibraryBar /> : <SelectingBar />;
}

function LibraryBar(): ReactNode {
    const assembly = useTargetAssembly();
    const isSignedIn = useIsSignedIn();
    return assembly && isSignedIn ? <ActionBar /> : <SelectingBar />;
}

/** Only while a query list limits picks. */
function SelectingBar(): ReactNode {
    const isFiltering = useOnshapeSelection(
        (state) => state.filtering !== undefined
    );
    const label = useOnshapeSelection((state) => listLabel(state.focused));
    if (!isFiltering) {
        return null;
    }
    return (
        <BarRow>
            <AppIcon
                icon={CursorClickIcon}
                size={IconSize.MEDIUM}
                color={PrimaryColor.FILLED}
                className={styles.noShrink}
            />
            <Text size="sm" flex={1} truncate>
                {label === undefined
                    ? m.contextBarFinish()
                    : m.contextBarSelecting({ label })}
            </Text>
            <Button
                size="compact-sm"
                onClick={() => useOnshapeSelection.getState().finishSelecting()}
            >
                {m.contextBarFinish()}
            </Button>
        </BarRow>
    );
}

interface BarRowProps {
    children: ReactNode;
}

function BarRow(props: BarRowProps): ReactNode {
    return (
        <Group
            gap="xs"
            px="sm"
            h={BAR_HEIGHT}
            wrap="nowrap"
            className={`${styles.frame} ${styles.dividerTop}`}
        >
            {props.children}
        </Group>
    );
}

/** What the bar has open under it. */
enum BarAction {
    PRESELECTION = "preselection"
}

/** The library's actions, and the one open under them. */
function ActionBar(): ReactNode {
    const [open, setOpen] = useState<BarAction>();
    const pickCount = useFastenPicks((state) => state.targets.length);
    const insertLocation = useInsertLocation();
    const isMenuOpen = useUiState(
        (state) => state.openInsertableId !== undefined
    );
    const isPreselecting = open === BarAction.PRESELECTION;

    const stop = () => {
        useOnshapeSelection.getState().finishSelecting();
        setOpen(undefined);
    };

    const togglePreselection = () => {
        if (isPreselecting) {
            stop();
            return;
        }
        setOpen(BarAction.PRESELECTION);
        // Clicked, as its list would be: Onshape limits picks to what it takes.
        useOnshapeSelection.getState().activate(FASTEN_TARGETS_LIST);
    };

    return (
        <>
            <BarRow>
                <Button
                    size="compact-sm"
                    variant={isPreselecting ? "filled" : undefined}
                    leftSection={<CursorClickIcon />}
                    rightSection={
                        pickCount > 0 && (
                            <Badge size="sm" circle>
                                {pickCount}
                            </Badge>
                        )
                    }
                    onClick={togglePreselection}
                >
                    {m.contextBarPreselection()}
                </Button>
                {insertLocation && insertLocation.instanceId === undefined && (
                    <AddInsertLocationButton insertLocation={insertLocation} />
                )}
            </BarRow>
            {/* Two lists of the same id would both take picks, so the insert menu's replace these while it's open. */}
            {!isMenuOpen && (
                // Hidden by display alone: its lists take picks while closed, which needs their effects.
                <Collapse
                    expanded={isPreselecting}
                    keepMountedMode="display-none"
                    transitionDuration={0}
                >
                    <Box
                        p="sm"
                        mah="50dvh"
                        className={styles.frame}
                        style={{ overflowY: "auto" }}
                    >
                        <ParameterGrid>
                            <FastenPicks />
                        </ParameterGrid>
                        <Group gap="xs" justify="flex-end" mt="sm">
                            <Button
                                size="compact-sm"
                                variant="default"
                                onClick={() => {
                                    clearFastenPicks();
                                    stop();
                                }}
                            >
                                {m.contextBarCancel()}
                            </Button>
                            <Button size="compact-sm" onClick={stop}>
                                {m.contextBarDone()}
                            </Button>
                        </Group>
                    </Box>
                </Collapse>
            )}
        </>
    );
}

interface AddInsertLocationButtonProps {
    insertLocation: InsertLocation;
}

function AddInsertLocationButton(
    props: AddInsertLocationButtonProps
): ReactNode {
    const addMutation = useAddInsertLocationMutation(
        props.insertLocation.target
    );
    return (
        <Button
            size="compact-sm"
            leftSection={<TargetIcon />}
            rightSection={<PlusIcon size={IconSize.TINY} />}
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
        >
            {m.contextBarAddInsertLocation()}
        </Button>
    );
}
