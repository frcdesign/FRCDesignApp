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
import {
    BORDER,
    CHROME_BACKGROUND,
    IconSize,
    PrimaryColor
} from "../lib/style-constants";
import { ReactNode, RefObject, useRef } from "react";
import { useMatch, useNavigate } from "@tanstack/react-router";

import frcDesignBook from "/frc-design-book.svg";
import { openSettingsMenu } from "../features/settings/open-settings-menu";
import { VendorMenu } from "../features/settings/components/vendor-filters";
import { useUiState } from "../lib/ui-state";
import { getLibraryName, useLibraryId } from "../features/library/library-path";
import { RequireAccessLevel } from "../features/auth/access-level";
import { useSaveSettings } from "../features/settings/settings";
import { useAccessData } from "../features/auth/access-level";
import { startSignIn } from "../features/auth/sign-in";
import { useJobStatus } from "../lib/refresh";
import { LibraryId } from "@backend/features/library/library-id";
import { queryClient } from "../lib/query-client";
import { getLibraryVersionQuery } from "../features/library/queries";

/**
 * Provides top-level navigation for the app: a row of tabs with the brand and
 * settings alongside, over a row holding search and its filters.
 */
export function AppNavbar(): ReactNode {
    const activeTab = useActiveTab();
    return (
        <Stack gap={0}>
            {/* Stretched so the tabs run the full height and their underline
                lands on the row's own border. */}
            <Group
                gap="sm"
                px="sm"
                wrap="nowrap"
                align="stretch"
                bg={CHROME_BACKGROUND}
                style={{ borderBottom: BORDER }}
            >
                <FrcDesignBookIcon />
                <AppTabs activeTab={activeTab} />
                <Group gap="xs" wrap="nowrap" ml="auto">
                    <JobIndicator />
                    <SignInButton />
                    <SettingsButton />
                </Group>
            </Group>
            {/* Search covers the library, so it has nothing to offer the
                tabs that aren't one. */}
            {activeTab !== BOLT_HELPER_TAB && (
                <Group gap="xs" p="sm" wrap="nowrap">
                    <SearchBar />
                    <VendorMenu />
                </Group>
            )}
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
            bg={PrimaryColor.FILLED}
            c={PrimaryColor.CONTRAST}
            style={{
                borderRadius: "var(--mantine-radius-sm)",
                display: "grid",
                placeItems: "center"
            }}
        >
            {/* Masked, not drawn, so the book takes the tile's contrast color
                rather than the gray in the file. The url needs quoting: Vite
                inlines the asset as a data uri containing apostrophes. */}
            <Box
                w={IconSize.SMALL}
                h={IconSize.SMALL}
                style={{
                    backgroundColor: "currentColor",
                    maskImage: `url("${frcDesignBook}")`,
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center"
                }}
            />
        </Box>
    );
}

/** The one tab that isn't a library; its own route holds the tool. */
const BOLT_HELPER_TAB = "bolt-helper";

/** Which tab the url has open, libraries aside. */
function useActiveTab(): string {
    const libraryId = useLibraryId();
    const boltHelperMatch = useMatch({
        from: "/app/bolt-helper",
        shouldThrow: false
    });
    return boltHelperMatch ? BOLT_HELPER_TAB : libraryId;
}

/** Switches tabs; the url is what actually selects one. */
function AppTabs({ activeTab }: { activeTab: string }): ReactNode {
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
            value={activeTab}
            onMouseEnter={prefetchVersions}
            onChange={(value) => {
                if (!value || value === activeTab) {
                    return;
                }
                if (value === BOLT_HELPER_TAB) {
                    void navigate({ to: "/app/bolt-helper" });
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
                // Hides the line under the tab list alone; the row owns one
                // that spans it. The active indicator is colored separately.
                root: { "--tab-border-color": "transparent" },
                // Three full names outgrow a narrow panel; scrolling beats
                // reflowing the navbar into two rows.
                list: {
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    scrollbarWidth: "none"
                },
                // Pulled onto that divider, so the active tab's indicator
                // replaces it rather than stacking a line above it.
                tab: {
                    marginBottom: -1,
                    paddingInline: "var(--mantine-spacing-sm)"
                }
            }}
        >
            <Tabs.List aria-label="Libraries and tools">
                {Object.values(LibraryId).map((libraryId) => (
                    <Tabs.Tab key={libraryId} value={libraryId}>
                        {getLibraryName(libraryId)}
                    </Tabs.Tab>
                ))}
                <Tabs.Tab value={BOLT_HELPER_TAB}>Bolt Helper</Tabs.Tab>
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
            size="lg"
            onClick={() => openSettingsMenu()}
        >
            <Gear size={IconSize.MEDIUM} />
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
            // The panel opens to a library the caller is here to search.
            autoFocus
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
