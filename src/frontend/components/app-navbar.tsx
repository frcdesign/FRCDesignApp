import {
    ActionIcon,
    Button,
    Divider,
    Group,
    Input,
    Menu,
    Stack,
    TextInput
} from "@mantine/core";
import {
    BooksIcon,
    CaretDownIcon,
    GearIcon,
    GitBranchIcon,
    type Icon,
    MagnifyingGlassIcon,
    MoonIcon,
    SunIcon
} from "@phosphor-icons/react";
import {
    IconSize,
    NAVBAR_DIVIDER_COLOR,
    NAVBAR_ROW_HEIGHT,
    StatusColor
} from "../lib/style-constants";
import styles from "../lib/styles.module.css";
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
import { AppIcon } from "./app-icon";
import { NewBadge, NewIndicator } from "./new-feature";
import { LibraryStatusBadge } from "./library-status-badge";
import { MenuSection } from "./app-menu";
import { openSettingsMenu } from "../features/settings/open-settings-menu";
import { VendorMenu } from "../features/settings/components/vendor-filters";
import { getUiState, Theme, updateUiState, useUiState } from "../lib/ui-state";
import {
    getLibraryName,
    getLibraryProgram,
    useLibraryId
} from "../lib/library";
import { useNeedsSignIn } from "../features/auth/access-level";
import { startSignIn } from "../features/auth/sign-in";
import { getLibraryVersionQuery } from "../features/library/queries";
import { LibraryId } from "@backend/features/library/library-id";
import { AppColor, getLibraryColor, toShade } from "../theme";
import { queryClient } from "../lib/query-client";
import { InsertLocationStatus } from "../features/insert-location/components/insert-location-status";
import {
    useIsVersionManager,
    useIsVersionManagerNew
} from "../features/version-manager/navigation";
import { useTargetWorkspace } from "../lib/onshape-params";
import { type AppTab, UtilityTab } from "../lib/app-tab";
import { getTabName, useNavigateToTab } from "../lib/tabs";

/** Stretched so a full-height child's underline lands on the row's border. */
export function NavbarRow(props: PropsWithChildren): ReactNode {
    const { children } = props;
    return (
        <Group
            gap="sm"
            px="sm"
            h={NAVBAR_ROW_HEIGHT}
            align="stretch"
            className={`${styles.frame} ${styles.dividerBottom}`}
        >
            <AppBrand />
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

/** The page picker with the brand and settings, over search and its filters. */
export function AppNavbar(): ReactNode {
    // Search and its filters belong to a library, and the version manager is
    // not one; its page fills the room they leave.
    const isVersionManager = useIsVersionManager();

    return (
        <Stack gap={0}>
            <NavbarRow>
                <PagePicker />
                <Group gap="xs" ml="auto" className={styles.noShrink}>
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
    const needsSignIn = useNeedsSignIn();
    // Otherwise the button flashes on every load for someone signed in.
    if (!needsSignIn) return null;

    return (
        <Button variant="outline" size="sm" my="auto" onClick={startSignIn}>
            Sign in
        </Button>
    );
}

/** What the menu files the pages that are not a library under. */
const UTILITIES_GROUP = "Utilities";

/** One of the app's top-level pages, as the page picker lists it. */
interface AppPage {
    tab: AppTab;
    /** The heading the menu lists it under: its program, or the utilities. */
    group: string;
    /** A book for a library. */
    icon: Icon;
    /** The color the page themes the app in, which its icon and badge take. */
    color: string;
    badge?: ReactNode;
    /** Worth pointing out behind the closed menu. */
    isNew?: boolean;
}

function useAppPages(): AppPage[] {
    const targetWorkspace = useTargetWorkspace();
    const isVersionManager = useIsVersionManager();
    const isNew = useIsVersionManagerNew();

    const libraries = Object.values(LibraryId).map((libraryId) => ({
        tab: libraryId,
        group: getLibraryProgram(libraryId),
        icon: BooksIcon,
        color: getLibraryColor(libraryId),
        badge: (
            <LibraryStatusBadge
                libraryId={libraryId}
                color={getLibraryColor(libraryId)}
            />
        )
    }));

    // Listed while it is showing even without a workspace, so the picker never
    // names a page it does not offer.
    if (!targetWorkspace && !isVersionManager) {
        return libraries;
    }
    return [
        ...libraries,
        {
            tab: UtilityTab.VERSION_MANAGER,
            group: UTILITIES_GROUP,
            icon: GitBranchIcon,
            color: AppColor.VERSION_MANAGER,
            badge: isNew ? <NewBadge /> : undefined,
            isNew
        }
    ];
}

/** The pages under their headings, each heading where its first page comes. */
function groupPages(pages: AppPage[]): [string, AppPage[]][] {
    const groups = new Map<string, AppPage[]>();
    for (const page of pages) {
        groups.set(page.group, [...(groups.get(page.group) ?? []), page]);
    }
    return [...groups];
}

/** The app's top-level pages, as a dropdown naming the one showing. */
function PagePicker(): ReactNode {
    const pages = useAppPages();
    const currentLibraryId = useLibraryId();
    const isVersionManager = useIsVersionManager();
    const navigateToTab = useNavigateToTab();

    const current: AppTab = isVersionManager
        ? UtilityTab.VERSION_MANAGER
        : currentLibraryId;
    const currentPage = pages.find((page) => page.tab === current);

    // Warm the versions on hover, so picking one has nothing left to wait for.
    const prefetchVersions = () => {
        for (const libraryId of Object.values(LibraryId)) {
            void queryClient.prefetchQuery(getLibraryVersionQuery(libraryId));
        }
    };

    const selectPage = (tab: AppTab) => {
        updateUiState({ tabId: tab });
        navigateToTab(tab);
    };

    return (
        <Menu position="bottom-start">
            {/* The dot wraps the target: the menu hands its props to the
                button, and the wrapper is what the row centres. */}
            <NewIndicator
                shown={pages.some((page) => page.isNew)}
                my="auto"
                className={styles.noShrink}
            >
                <Menu.Target>
                    <Button
                        variant="subtle"
                        color={StatusColor.NEUTRAL}
                        px="xs"
                        onMouseEnter={prefetchVersions}
                        leftSection={
                            currentPage && (
                                <AppIcon
                                    icon={currentPage.icon}
                                    size={IconSize.MEDIUM}
                                    color={toShade(currentPage.color)}
                                />
                            )
                        }
                        rightSection={<CaretDownIcon size={IconSize.SMALL} />}
                    >
                        {getTabName(current)}
                    </Button>
                </Menu.Target>
            </NewIndicator>
            <Menu.Dropdown>
                {groupPages(pages).map(([group, grouped]) => (
                    <MenuSection key={group} label={group}>
                        {grouped.map((page) => (
                            <Menu.Item
                                key={page.tab}
                                disabled={page.tab === current}
                                leftSection={
                                    <NewIndicator
                                        shown={page.isNew ?? false}
                                        offset={-1}
                                    >
                                        <AppIcon
                                            icon={page.icon}
                                            size={IconSize.MEDIUM}
                                            color={toShade(page.color)}
                                        />
                                    </NewIndicator>
                                }
                                onClick={() => selectPage(page.tab)}
                            >
                                <Group gap="xs">
                                    {getTabName(page.tab)}
                                    {page.badge}
                                </Group>
                            </Menu.Item>
                        ))}
                    </MenuSection>
                ))}
            </Menu.Dropdown>
        </Menu>
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
