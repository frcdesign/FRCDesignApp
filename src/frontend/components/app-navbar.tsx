import {
    ActionIcon,
    Box,
    Button,
    Group,
    Input,
    Loader,
    Stack,
    Tabs,
    TextInput,
    Tooltip
} from "@mantine/core";
import { Gear, MagnifyingGlass } from "@phosphor-icons/react";
import { BORDER, IconSize } from "../lib/style-constants";
import { ReactNode, RefObject, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

import frcDesignBook from "/frc-design-book.svg";
import { openSettingsMenu } from "../features/settings/open-settings-menu";
import { VendorMenu } from "../features/settings/components/vendor-filters";
import { useUiState } from "../lib/ui-state";
import {
    getLibraryFullName,
    getLibraryName,
    getLibraryTabLabel,
    useLibraryId
} from "../features/library/library-path";
import { RequireAccessLevel } from "../features/auth/access-level";
import { useSaveSettings } from "../features/settings/settings";
import { useAccessData } from "../features/auth/access-level";
import { startSignIn } from "../features/auth/sign-in";
import { useJobStatus } from "../lib/refresh";
import { LibraryId } from "@backend/features/library/library-id";
import { queryClient } from "../lib/query-client";
import { getLibraryVersionQuery } from "../features/library/queries";

/**
 * Provides top-level navigation for the app: a row of library tabs with the
 * brand and settings alongside, over a row holding search and its filters.
 */
export function AppNavbar(): ReactNode {
    return (
        <Stack gap={0}>
            {/* Stretched so the tabs run the full height and their underline
                lands on the row's own border. */}
            <Group
                gap="sm"
                px="sm"
                wrap="nowrap"
                align="stretch"
                style={{ borderBottom: BORDER }}
            >
                <FrcDesignBookIcon />
                <LibraryTabs />
                <Group gap="xs" wrap="nowrap" ml="auto">
                    <JobIndicator />
                    <SignInButton />
                    <SettingsButton />
                </Group>
            </Group>
            <Group gap="xs" p="sm" wrap="nowrap">
                <SearchBar />
                <VendorMenu />
            </Group>
        </Stack>
    );
}

/**
 * Shown only when not signed in; starts the Onshape OAuth flow and returns to
 * the current location, after which access-data reports the caller signed in.
 */
function SignInButton(): ReactNode {
    const { signedIn, isPending } = useAccessData();
    // Waiting rather than assuming signed out: the placeholder would flash the
    // button on every load for a caller who is already signed in.
    if (isPending || signedIn) return null;

    return (
        <Button variant="outline" size="compact-sm" onClick={startSignIn}>
            Sign in
        </Button>
    );
}

/** Editor-only spinner shown while a library-load job is running. */
function JobIndicator(): ReactNode {
    return (
        <RequireAccessLevel>
            <RunningJobLoader />
        </RequireAccessLevel>
    );
}

function RunningJobLoader(): ReactNode {
    // Single editor-gated job-status consumer, so it owns refresh-on-finish.
    const jobRunning = useJobStatus();
    if (!jobRunning) return null;
    return (
        <Tooltip
            withArrow
            label="The library is being loaded from Onshape in the background"
        >
            <Loader size="sm" />
        </Tooltip>
    );
}

function FrcDesignBookIcon(): ReactNode {
    return (
        <Box
            component="a"
            href="https://frcdesign.org"
            target="_blank"
            aria-label="FRCDesign.org"
            w={IconSize.CONTROL}
            h={IconSize.CONTROL}
            my="auto"
            // Not the link color the anchor would otherwise hand the mask.
            c="var(--mantine-color-text)"
            // Masked rather than drawn, so the book takes the text color rather
            // than the gray baked into the file. The url has to be quoted:
            // Vite inlines this asset as a data uri containing apostrophes.
            style={{
                backgroundColor: "currentColor",
                maskImage: `url("${frcDesignBook}")`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center"
            }}
        />
    );
}

/** Switches libraries; the url is what actually selects one. */
function LibraryTabs(): ReactNode {
    const currentLibraryId = useLibraryId();
    const saveSettings = useSaveSettings();
    const navigate = useNavigate();

    // Warm the versions on hover, so picking one has nothing left to wait for.
    const prefetchVersions = () => {
        for (const libraryId of Object.values(LibraryId)) {
            void queryClient.prefetchQuery(getLibraryVersionQuery(libraryId));
        }
    };

    return (
        <Tabs
            value={currentLibraryId}
            onMouseEnter={prefetchVersions}
            onChange={(value) => {
                if (!value || value === currentLibraryId) {
                    return;
                }
                const libraryId = value as LibraryId;
                // Write-behind: the url displays it, this only decides where
                // `/init` lands next time.
                saveSettings({ libraryId });
                void navigate({
                    to: "/app/library/$libraryId",
                    params: { libraryId }
                });
            }}
            styles={{
                // Hides the line Mantine draws under the tab list alone —
                // the row owns one that runs the full width. The active tab's
                // indicator is colored separately and survives this.
                root: { "--tab-border-color": "transparent" },
                // Pulled onto that divider, so the active tab's indicator
                // replaces it instead of stacking a second line above it.
                tab: { marginBottom: -1 }
            }}
        >
            <Tabs.List aria-label="Libraries">
                {Object.values(LibraryId).map((libraryId) => (
                    <Tooltip
                        key={libraryId}
                        withArrow
                        label={getLibraryFullName(libraryId)}
                    >
                        <Tabs.Tab value={libraryId}>
                            {getLibraryTabLabel(libraryId)}
                        </Tabs.Tab>
                    </Tooltip>
                ))}
            </Tabs.List>
        </Tabs>
    );
}

export function SettingsButton() {
    return (
        <ActionIcon
            variant="subtle"
            color="gray"
            title="Settings"
            my="auto"
            size="input-sm"
            onClick={() => openSettingsMenu()}
        >
            <Gear size={IconSize.CONTROL} />
        </ActionIcon>
    );
}

function selectAllInputText(ref: RefObject<HTMLInputElement | null>) {
    const input = ref.current;
    if (!input) {
        return;
    }
    const length = input.value.length;
    input.setSelectionRange(0, length);
}

export function SearchBar() {
    const ref = useRef<HTMLInputElement>(null);
    const [uiState, setUiState] = useUiState();
    const libraryId = useLibraryId();

    const clearButton = uiState.searchQuery ? (
        <Input.ClearButton
            aria-label="Clear input"
            onClick={() => {
                if (ref.current) {
                    ref.current.value = "";
                }
                setUiState({ searchQuery: undefined });
            }}
        />
    ) : undefined;

    return (
        <TextInput
            type="search"
            flex={1}
            leftSection={<MagnifyingGlass size={IconSize.SMALL} />}
            placeholder={`Search ${getLibraryName(libraryId)}...`}
            ref={ref}
            value={uiState.searchQuery ?? ""}
            onFocus={() => {
                selectAllInputText(ref);
            }}
            onChange={(event) => {
                const value = event.currentTarget.value;
                const query = value === "" ? undefined : value;
                setUiState({ searchQuery: query });
            }}
            rightSection={clearButton}
        />
    );
}
