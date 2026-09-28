import {
    ActionIcon,
    Button,
    Divider,
    Group,
    Input,
    Menu,
    Stack,
    Tabs,
    TextInput
} from "@mantine/core";
import {
    CaretDownIcon,
    GearIcon,
    MagnifyingGlassIcon,
    MoonIcon,
    SunIcon
} from "@phosphor-icons/react";
import {
    IconSize,
    NAVBAR_DIVIDER_COLOR,
    NAVBAR_ROW_HEIGHT
} from "../lib/style-constants";
import {
    PropsWithChildren,
    ReactNode,
    RefObject,
    useEffect,
    useRef,
    useState
} from "react";
import { useDebouncedCallback } from "@mantine/hooks";

import { AppBrand } from "./app-brand";
import { openSettingsMenu } from "../features/settings/open-settings-menu";
import { VendorMenu } from "../features/settings/components/vendor-filters";
import { getUiState, Theme, updateUiState, useUiState } from "../lib/ui-state";
import { getLibraryName, useLibraryId } from "../lib/library";
import { getTabName, useAppTabs, useNavigateToTab } from "../lib/tabs";
import { useAccessData } from "../features/auth/access-level";
import { startSignIn } from "../features/auth/sign-in";
import { LibraryId } from "@backend/features/library/library-id";
import { type AppTab, UtilityTab } from "../lib/app-tab";
import { queryClient } from "../lib/query-client";
import { getLibraryVersionQuery } from "../features/library/queries";
import { InsertLocationStatus } from "../features/insert-location/components/insert-location-status";
import { useIsVersionManager } from "../features/version-manager/navigation";
import styles from "../lib/styles.module.css";

interface NavbarRowProps extends PropsWithChildren {
    /** The brand's mark without its name; see {@link AppBrand}. */
    markOnly?: boolean;
}

/** Stretched so a full-height child's underline lands on the row's border. */
export function NavbarRow(props: NavbarRowProps): ReactNode {
    const { children, markOnly } = props;
    return (
        <Group
            gap="sm"
            px="sm"
            h={NAVBAR_ROW_HEIGHT}
            align="stretch"
            className={`${styles.frame} ${styles.dividerBottom}`}
        >
            <AppBrand markOnly={markOnly} />
            {children && (
                // Mantine's own divider all but vanishes on gray.
                <Divider
                    orientation="vertical"
                    my="sm"
                    color={NAVBAR_DIVIDER_COLOR}
                />
            )}
            {children}
        </Group>
    );
}

export function AppNavbar(): ReactNode {
    // Search and its filters belong to a library, and the version manager is
    // not one; its page fills the room they leave.
    const isVersionManager = useIsVersionManager();

    return (
        <Stack gap={0}>
            {/* The mark alone: the library menu beside it names where you are,
                and the panel has no room for both. */}
            <NavbarRow markOnly>
                <LibraryMenu />
                <AppTabs />
                <Group gap="xs" ml="auto">
                    <InsertLocationStatus />
                    <SignInButton />
                    <SettingsControls />
                </Group>
            </NavbarRow>
            {!isVersionManager && (
                <Group gap="xs" px="sm" h={NAVBAR_ROW_HEIGHT}>
                    <SearchBar />
                    <VendorMenu />
                </Group>
            )}
        </Stack>
    );
}

function SignInButton(): ReactNode {
    const { signedIn, isPending } = useAccessData();
    // Otherwise the button flashes on every load for someone signed in.
    if (isPending || signedIn) return null;

    return (
        <Button variant="outline" size="sm" my="auto" onClick={startSignIn}>
            Sign in
        </Button>
    );
}

/** Which tab the page showing belongs to: a library, or a utility's page. */
function useCurrentTab(): AppTab {
    const libraryId = useLibraryId();
    const isVersionManager = useIsVersionManager();
    return isVersionManager ? UtilityTab.VERSION_MANAGER : libraryId;
}

/**
 * Picks the library. A menu rather than a tab each: there is one library in
 * view at a time, and a tab strip said otherwise while taking the room the
 * pages of the app's own need.
 */
function LibraryMenu(): ReactNode {
    const libraryId = useLibraryId();
    const navigateToTab = useNavigateToTab();

    // Warm the versions on hover, so picking one has nothing left to wait for.
    const prefetchVersions = () => {
        for (const id of Object.values(LibraryId)) {
            void queryClient.prefetchQuery(getLibraryVersionQuery(id));
        }
    };

    return (
        <Menu position="bottom-start" onOpen={prefetchVersions}>
            <Menu.Target>
                <Button
                    variant="default"
                    size="compact-sm"
                    my="auto"
                    className={styles.noShrink}
                    rightSection={<CaretDownIcon size={IconSize.SMALL} />}
                >
                    {getLibraryName(libraryId)}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                {Object.values(LibraryId).map((id) => (
                    <Menu.Item
                        key={id}
                        disabled={id === libraryId}
                        onClick={() => {
                            // Only decides where `/` resumes next time; the url
                            // is the source of truth.
                            updateUiState({ tabId: id });
                            navigateToTab(id);
                        }}
                    >
                        {getLibraryName(id)}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

/**
 * The app's own pages, beside the library the menu picked. Only the version
 * manager so far, and only where there is a workspace for it to act on.
 */
function AppTabs(): ReactNode {
    const currentTabId = useCurrentTab();
    const navigateToTab = useNavigateToTab();
    const tabs = useAppTabs();

    if (tabs.length === 0) {
        return null;
    }

    return (
        <Tabs
            value={currentTabId}
            onChange={(value) => {
                if (!value || value === currentTabId) {
                    return;
                }
                const tabId = value as AppTab;
                updateUiState({ tabId });
                navigateToTab(tabId);
            }}
            styles={{
                // The row draws the line under the tabs.
                root: { "--tab-border-color": "transparent", minWidth: 0 },
                // Scroll rather than wrap onto a second row in a narrow panel.
                list: {
                    // So the underline lands on the row's border.
                    height: "100%",
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    scrollbarWidth: "none"
                },
                // Overlaps the row's border, so the active indicator replaces it.
                tab: {
                    marginBottom: -1,
                    paddingInline: "var(--mantine-spacing-sm)"
                }
            }}
        >
            <Tabs.List>
                {tabs.map((tabId) => (
                    <Tabs.Tab key={tabId} value={tabId}>
                        {getTabName(tabId)}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
        </Tabs>
    );
}

/** The theme toggle and settings, flush: a pair of icons, not two controls. */
export function SettingsControls(): ReactNode {
    return (
        <Group gap={0}>
            <ThemeToggle />
            <SettingsButton />
        </Group>
    );
}

function ThemeToggle(): ReactNode {
    const theme = useUiState((state) => state.theme);
    const isDark = theme === Theme.DARK;
    return (
        <ActionIcon
            title={isDark ? "Light mode" : "Dark mode"}
            my="auto"
            size="input-sm"
            onClick={() =>
                updateUiState({ theme: isDark ? Theme.LIGHT : Theme.DARK })
            }
        >
            {isDark ? (
                <SunIcon size={IconSize.CONTROL} />
            ) : (
                <MoonIcon size={IconSize.CONTROL} />
            )}
        </ActionIcon>
    );
}

function SettingsButton() {
    return (
        <ActionIcon
            title="Settings"
            my="auto"
            // Matches the filter button.
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

const SEARCH_DEBOUNCE_MS = 200;

function SearchBar() {
    const ref = useRef<HTMLInputElement>(null);
    const wasFocused = useRef(false);
    const libraryId = useLibraryId();
    // Local state, so a keystroke re-renders only the input.
    const [query, setQuery] = useState(() => getUiState().searchQuery ?? "");
    const runSearch = useDebouncedCallback(
        (value: string) => {
            updateUiState({ searchQuery: value === "" ? undefined : value });
        },
        // Flushed on unmount, so what was typed is what comes back next time.
        { delay: SEARCH_DEBOUNCE_MS, flushOnUnmount: true }
    );

    // `autoFocus` fires before the ref attaches, so onFocus can't select.
    useEffect(() => {
        selectAllInputText(ref);
    }, []);

    const clearButton = query ? (
        <Input.ClearButton
            onClick={() => {
                setQuery("");
                // Nothing to wait out: the list should empty on the click.
                runSearch.cancel();
                updateUiState({ searchQuery: undefined });
            }}
        />
    ) : undefined;

    return (
        <TextInput
            type="search"
            // The panel opens to a library the caller is here to search.
            autoFocus
            flex={1}
            leftSection={<MagnifyingGlassIcon />}
            placeholder={`Search ${getLibraryName(libraryId)}...`}
            ref={ref}
            value={query}
            onFocus={() => {
                selectAllInputText(ref);
            }}
            // The mouseup of the click that focuses the input would collapse the
            // select-all; later clicks place the caret normally.
            onMouseDown={() => {
                wasFocused.current = document.activeElement === ref.current;
            }}
            onMouseUp={(event) => {
                if (!wasFocused.current) {
                    event.preventDefault();
                }
            }}
            onChange={(event) => {
                const value = event.currentTarget.value;
                setQuery(value);
                runSearch(value);
            }}
            rightSection={clearButton}
        />
    );
}
