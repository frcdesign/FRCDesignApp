import { type ReactNode, useEffect, useState } from "react";
import { Badge, Box, Button, Collapse, Group } from "@mantine/core";
import {
    CheckIcon,
    CursorClickIcon,
    PlusIcon,
    TargetIcon
} from "@phosphor-icons/react";
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
import { useOnshapeSelection } from "../lib/selection";
import { IconSize, StatusColor } from "../lib/style-constants";
import { useUiState } from "../lib/ui-state";
import { m } from "../paraglide/messages";
import styles from "../lib/styles.module.css";
import { ParameterGrid } from "./parameter-input";

const BAR_HEIGHT = 40;

interface ContextBarProps {
    /** Inserting is a library page's; a utility's page places nothing from a row. */
    isLibrary: boolean;
}

/**
 * The header's last row, on a library page in an assembly: the actions that
 * work with the Onshape window, each opening its query lists under the bar and
 * starting to select. Nothing elsewhere.
 */
export function ContextBar(props: ContextBarProps): ReactNode {
    const assembly = useTargetAssembly();
    const isSignedIn = useIsSignedIn();
    return props.isLibrary && assembly && isSignedIn ? (
        <LibraryActions />
    ) : null;
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
function LibraryActions(): ReactNode {
    const [open, setOpen] = useState<BarAction>();
    const pickCount = useFastenPicks((state) => state.targets.length);
    const insertLocation = useInsertLocation();
    const isMenuOpen = useUiState(
        (state) => state.openInsertableId !== undefined
    );
    const isPreselecting = open === BarAction.PRESELECTION;
    // Added from here, it stays to say so
    const [isAdded, setIsAdded] = useState(false);

    // Finished from the selecting action bar, it closes too
    useEffect(
        () =>
            useOnshapeSelection.subscribe((state, previous) => {
                if (state.isFinished && !previous.isFinished) {
                    setOpen(undefined);
                }
            }),
        []
    );

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
                            // Mantine's badge sets its own cursor
                            <Badge
                                size="sm"
                                circle
                                style={{ cursor: "inherit" }}
                            >
                                {pickCount}
                            </Badge>
                        )
                    }
                    onClick={togglePreselection}
                >
                    {m.contextBarPreselection()}
                </Button>
                {insertLocation &&
                    (isAdded || insertLocation.instanceId === undefined) && (
                        <AddInsertLocationButton
                            insertLocation={insertLocation}
                            isAdded={isAdded}
                            onAdded={() => setIsAdded(true)}
                        />
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
    isAdded: boolean;
    onAdded: () => void;
}

/** Adds one, then says it's added in its place. */
function AddInsertLocationButton(
    props: AddInsertLocationButtonProps
): ReactNode {
    const { insertLocation, isAdded, onAdded } = props;
    const addMutation = useAddInsertLocationMutation(insertLocation.target);
    if (isAdded) {
        return (
            <Button
                component="div"
                size="compact-sm"
                variant="light"
                color={StatusColor.SUCCESS}
                leftSection={<CheckIcon />}
            >
                {m.contextBarInsertLocationAdded()}
            </Button>
        );
    }
    return (
        <Button
            size="compact-sm"
            leftSection={<TargetIcon />}
            rightSection={<PlusIcon size={IconSize.TINY} />}
            loading={addMutation.isPending}
            onClick={() =>
                addMutation.mutate(undefined, { onSuccess: onAdded })
            }
        >
            {m.contextBarAddInsertLocation()}
        </Button>
    );
}
