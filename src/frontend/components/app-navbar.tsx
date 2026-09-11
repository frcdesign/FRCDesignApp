import {
    ActionIcon,
    Button,
    Group,
    Input,
    Loader,
    Stack,
    Tabs,
    TextInput,
    Tooltip
} from "@mantine/core";
import { GearIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
    BORDER,
    FRAME_BACKGROUND,
    IconSize,
    NAVBAR_ROW_HEIGHT,
    StatusColor
} from "../lib/style-constants";
import { ReactNode, RefObject, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AppBrand } from "./app-brand";
import { openSettingsMenu } from "../features/settings/open-settings-menu";
import { VendorMenu } from "../features/settings/components/vendor-filters";
import { useGetUiState, useSetUiState } from "../lib/ui-state";
import { getLibraryName, useLibraryId } from "../features/library/library-path";
import {
    RequireAccessLevel,
    useAccessData
} from "../features/auth/access-level";
import { useSaveSettings } from "../features/settings/settings";
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
                h={NAVBAR_ROW_HEIGHT}
                wrap="nowrap"
                align="stretch"
                bg={FRAME_BACKGROUND}
                style={{ borderBottom: BORDER }}
            >
                <AppBrand />
                <LibraryTabs />
                <Group gap="xs" wrap="nowrap" ml="auto">
                    <JobIndicator />
                    <SignInButton />
                    <SettingsButton />
                </Group>
            </Group>
            <Group gap="xs" px="sm" h={NAVBAR_ROW_HEIGHT} wrap="nowrap">
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
        <Button variant="outline" size="sm" my="auto" onClick={startSignIn}>
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
            <Loader size={IconSize.CONTROL} />
        </Tooltip>
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
                // Hides the line under the tab list alone; the row owns one
                // that spans it. The active indicator is colored separately.
                root: { "--tab-border-color": "transparent", minWidth: 0 },
                // Three full names outgrow a narrow panel; scrolling beats
                // reflowing the navbar into two rows.
                list: {
                    // Full height, so the underline lands on the row's border
                    // rather than partway up a taller bar.
                    height: "100%",
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
            <Tabs.List aria-label="Libraries">
                {Object.values(LibraryId).map((libraryId) => (
                    <Tabs.Tab key={libraryId} value={libraryId}>
                        {getLibraryName(libraryId)}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
        </Tabs>
    );
}

export function SettingsButton() {
    return (
        <ActionIcon
            variant="subtle"
            color={StatusColor.NEUTRAL}
            title="Settings"
            my="auto"
            // The filter button's size and icon, so the navbar's two rows read
            // as one set of controls.
            size="input-sm"
            onClick={() => openSettingsMenu()}
        >
            <GearIcon size={IconSize.CONTROL} />
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

function SearchBar() {
    const ref = useRef<HTMLInputElement>(null);
    const uiState = useGetUiState();
    const setUiState = useSetUiState();
    const libraryId = useLibraryId();

    // `autoFocus` fires before the ref attaches, so onFocus has nothing to select
    // through on the first open and last time's query keeps the caret after it.
    useEffect(() => {
        selectAllInputText(ref);
    }, []);

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
            leftSection={<MagnifyingGlassIcon size={IconSize.SMALL} />}
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
