import {
    ActionIcon,
    Button,
    Divider,
    Group,
    Input,
    Menu,
    Stack,
    TextInput,
    Tooltip
} from "@mantine/core";
import {
    BooksIcon,
    CaretDownIcon,
    GearIcon,
    GitBranchIcon,
    ScrewdriverIcon,
    type Icon,
    ListChecksIcon,
    MagnifyingGlassIcon,
    MoonIcon,
    PuzzlePieceIcon,
    SlidersHorizontalIcon,
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
    useEffect,
    useRef,
    useState
} from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { useSelectAllOnFocus } from "../lib/select-all";

import { AppBrand } from "./app-brand";
import { AppIcon } from "./app-icon";
import { NewBadge } from "./new-feature";
import { DotIndicator } from "./dot-indicator";
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
import { ContextBar } from "./context-bar";
import { useIsVersionManager } from "../features/version-manager/navigation";
import { useTargetElement, useTargetWorkspace } from "../lib/onshape-params";
import {
    useIsAutoAssembly,
    useIsAutoAssemblyNew
} from "../features/auto-assembly/navigation";
import { useIsFeatureScripts } from "../features/featurescripts/navigation";
import { FeatureScriptSearchBar } from "../features/featurescripts/components/featurescript-search-bar";
import {
    useIsDesignCheck,
    useIsDesignCheckNew
} from "../features/design-check/navigation";
import { openDesignCheckLevels } from "../features/design-check/open-design-check-levels";
import {
    checkAgain,
    useDesignCheckLevelsQuery
} from "../features/design-check/queries";
import { type WorkspacePath } from "@backend/features/version-manager/contract";
import { type AppTab, UtilityTab } from "../lib/app-tab";
import { getTabName, useNavigateToTab } from "../lib/tabs";
import { useRefreshVersionManagerMutation } from "../features/version-manager/queries";
import { RefreshButton } from "./refresh-button";
import { useIsFetching } from "@tanstack/react-query";
import { designCheckQueryKey } from "../lib/query-keys";
import { m } from "../paraglide/messages";

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

/** The page picker with the brand and settings, over search and its filters, then the context bar. */
export function AppNavbar(): ReactNode {
    // Search and its filters belong to a library; FeatureScripts has a search
    // of its own there, and the other utilities' pages fill the room.
    const isVersionManager = useIsVersionManager();
    const isAutoAssembly = useIsAutoAssembly();
    const isFeatureScripts = useIsFeatureScripts();
    const isDesignCheck = useIsDesignCheck();
    const isLibrary =
        !isVersionManager &&
        !isAutoAssembly &&
        !isFeatureScripts &&
        !isDesignCheck;
    const workspace = useTargetWorkspace();

    return (
        <Stack gap={0}>
            <NavbarRow>
                <PagePicker />
                <Group gap="xs" ml="auto" className={styles.noShrink}>
                    <SignInButton />
                    {isVersionManager && workspace && (
                        <VersionManagerRefreshButton workspace={workspace} />
                    )}
                    {isDesignCheck && <DesignCheckLevelsButton />}
                    {isDesignCheck && <DesignCheckRefreshButton />}
                    <SettingsControls />
                </Group>
            </NavbarRow>
            {isLibrary && (
                <Group gap="xs" px="sm" h={NAVBAR_ROW_HEIGHT}>
                    <SearchBar />
                    <VendorMenu />
                </Group>
            )}
            {isFeatureScripts && (
                <Group gap="xs" px="sm" h={NAVBAR_ROW_HEIGHT}>
                    <FeatureScriptSearchBar />
                </Group>
            )}
            <ContextBar isLibrary={isLibrary} />
        </Stack>
    );
}

export function SignInButton(): ReactNode {
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
    const targetElement = useTargetElement();
    const isAutoAssembly = useIsAutoAssembly();
    const isNew = useIsAutoAssemblyNew();
    const isDesignCheck = useIsDesignCheck();
    const isDesignCheckNew = useIsDesignCheckNew();

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

    // Needs no document: browsing works anywhere, and adding says why it can't.
    const featureScripts: AppPage = {
        tab: UtilityTab.FEATURESCRIPTS,
        group: UTILITIES_GROUP,
        icon: PuzzlePieceIcon,
        color: AppColor.FEATURESCRIPTS
    };
    // Each is listed while it is showing even without an element, so the picker never names a page it does not offer.
    const autoAssembly: AppPage[] =
        targetElement || isAutoAssembly
            ? [
                  {
                      tab: UtilityTab.AUTO_ASSEMBLY,
                      group: UTILITIES_GROUP,
                      icon: ScrewdriverIcon,
                      color: AppColor.AUTO_ASSEMBLY,
                      badge: isNew ? <NewBadge /> : undefined,
                      isNew
                  }
              ]
            : [];
    const designCheck: AppPage[] =
        targetElement || isDesignCheck
            ? [
                  {
                      tab: UtilityTab.DESIGN_CHECK,
                      group: UTILITIES_GROUP,
                      icon: ListChecksIcon,
                      color: AppColor.DESIGN_CHECK,
                      badge: isDesignCheckNew ? <NewBadge /> : undefined,
                      isNew: isDesignCheckNew
                  }
              ]
            : [];

    return [
        ...libraries,
        featureScripts,
        {
            tab: UtilityTab.VERSION_MANAGER,
            group: UTILITIES_GROUP,
            icon: GitBranchIcon,
            color: AppColor.VERSION_MANAGER
        },
        ...autoAssembly,
        ...designCheck
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
    const isAutoAssembly = useIsAutoAssembly();
    const isFeatureScripts = useIsFeatureScripts();
    const isDesignCheck = useIsDesignCheck();
    const navigateToTab = useNavigateToTab();

    const current: AppTab = isVersionManager
        ? UtilityTab.VERSION_MANAGER
        : isAutoAssembly
          ? UtilityTab.AUTO_ASSEMBLY
          : isFeatureScripts
            ? UtilityTab.FEATURESCRIPTS
            : isDesignCheck
              ? UtilityTab.DESIGN_CHECK
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
            <DotIndicator
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
            </DotIndicator>
            <Menu.Dropdown>
                {groupPages(pages).map(([group, grouped]) => (
                    <MenuSection key={group} label={group}>
                        {grouped.map((page) => (
                            <Menu.Item
                                key={page.tab}
                                disabled={page.tab === current}
                                leftSection={
                                    <DotIndicator
                                        shown={page.isNew ?? false}
                                        offset={-1}
                                    >
                                        {/* Inline, it sits on a line of text above the label's center */}
                                        <AppIcon
                                            icon={page.icon}
                                            size={IconSize.MEDIUM}
                                            color={toShade(page.color)}
                                            style={{ display: "block" }}
                                        />
                                    </DotIndicator>
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

interface VersionManagerRefreshButtonProps {
    workspace: WorkspacePath;
}

/** Reads the linked documents again, past what the server cached of them. */
function VersionManagerRefreshButton(
    props: VersionManagerRefreshButtonProps
): ReactNode {
    const { workspace } = props;
    const refresh = useRefreshVersionManagerMutation(workspace);
    return (
        <RefreshButton
            loading={refresh.isPending}
            onClick={() => refresh.mutate()}
        />
    );
}

/** Saved to the account, so only once signed in, and only once they've loaded. */
function DesignCheckLevelsButton(): ReactNode {
    const levels = useDesignCheckLevelsQuery();
    if (!levels.data) return null;
    return (
        <Tooltip label={m.designCheckLevels()}>
            <ActionIcon my="auto" onClick={openDesignCheckLevels}>
                <SlidersHorizontalIcon size={IconSize.MEDIUM} />
            </ActionIcon>
        </Tooltip>
    );
}

/** Checks the tab again, which spends Onshape calls, so only when asked. */
function DesignCheckRefreshButton(): ReactNode {
    const target = useTargetElement();
    const isFetching = useIsFetching({
        queryKey: target ? designCheckQueryKey(target) : ["design-check"]
    });
    if (!target) return null;
    return (
        <RefreshButton
            label={m.designCheckAgain()}
            loading={isFetching > 0}
            onClick={() => void checkAgain(target)}
        />
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

const SEARCH_DEBOUNCE_MS = 200;

function SearchBar() {
    const ref = useRef<HTMLInputElement>(null);
    const selectAll = useSelectAllOnFocus();
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
        ref.current?.select();
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
            {...selectAll}
            onChange={(event) => {
                const value = event.currentTarget.value;
                setQuery(value);
                runSearch(value);
            }}
            rightSection={clearButton}
        />
    );
}
