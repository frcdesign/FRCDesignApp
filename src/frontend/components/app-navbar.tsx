import {
    ActionIcon,
    Badge,
    Button,
    Divider,
    Group,
    Indicator,
    Input,
    Loader,
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
import { useNavigate } from "@tanstack/react-router";
import { useDebouncedCallback } from "@mantine/hooks";

import { AppBrand } from "./app-brand";
import { AppIcon } from "./app-icon";
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
import {
    RequireAccessLevel,
    useNeedsSignIn
} from "../features/auth/access-level";
import { startSignIn } from "../features/auth/sign-in";
import {
    getLibraryVersionQuery,
    useIsLibraryLoading
} from "../features/library/queries";
import { LibraryId } from "@backend/features/library/library-id";
import { AppColor, getLibraryColor, toShade } from "../theme";
import { queryClient } from "../lib/query-client";
import { InsertLocationStatus } from "../features/insert-location/components/insert-location-status";
import {
    useIsVersionManager,
    useIsVersionManagerNew
} from "../features/version-manager/navigation";
import { useTargetWorkspace } from "../lib/onshape-params";

/**
 * The bar every page is topped by: the brand, then whatever that page puts
 * beside it. Stretched so a full-height child lands its underline on the row's
 * own border.
 *
 * Narrow, the row gives in one order, and nothing else in it has to be told
 * about widths: the brand folds to its tile at a width of its own, the controls
 * are pinned because half a button is no use, and the pages — the only thing
 * left that can — take whatever squeeze is still on, clipping their name.
 */
export function NavbarRow(props: PropsWithChildren): ReactNode {
    const { children } = props;
    return (
        <Group
            gap="sm"
            px="sm"
            h={NAVBAR_ROW_HEIGHT}
            wrap="nowrap"
            align="stretch"
            className={`${styles.frame} ${styles.dividerBottom}`}
        >
            <AppBrand />
            {children && (
                // Closes the brand off, so the name reads as the app rather
                // than the first tab. Mantine's own all but vanishes on gray.
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

/**
 * Provides top-level navigation for the app: a row of library tabs with the
 * brand and settings alongside, over a row holding search and its filters.
 */
export function AppNavbar(): ReactNode {
    // Search and its filters belong to a library, and the version manager is
    // not one; its page fills the room they leave.
    const isVersionManager = useIsVersionManager();

    return (
        <Stack gap={0}>
            <NavbarRow>
                <PagePicker />
                <Group
                    gap="xs"
                    wrap="nowrap"
                    ml="auto"
                    className={styles.noShrink}
                >
                    <InsertLocationStatus />
                    <JobIndicator />
                    <SignInButton />
                    <SettingsControls />
                </Group>
            </NavbarRow>
            {!isVersionManager && (
                <Group gap="xs" px="sm" h={NAVBAR_ROW_HEIGHT} wrap="nowrap">
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
    const needsSignIn = useNeedsSignIn();
    // Waiting rather than assuming signed out: the button would otherwise
    // flash on every load for a caller who is already signed in.
    if (!needsSignIn) return null;

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
    const jobRunning = useIsLibraryLoading();
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

/**
 * The value the version manager's tab takes. Not a library id, so it can never
 * collide with one.
 */
const VERSION_MANAGER_TAB = "version-manager";

/** What the version manager's page is called wherever it is offered. */
const VERSION_MANAGER_LABEL = "Version Manager";

/** What the menu files the pages that are not a library under. */
const UTILITIES_GROUP = "Utilities";

/** One of the app's top-level pages, as both the tab row and the menu list it. */
interface AppPage {
    /** A library id, or {@link VERSION_MANAGER_TAB}. */
    value: string;
    label: string;
    /** The heading the menu lists it under: its program, or the utilities. */
    group: string;
    /** What the page is marked with: a book for a library. */
    icon: Icon;
    /** The color the page themes the app in, which its icon and badge take. */
    color: string;
    /** What marks the page out, wherever it is listed. */
    badge?: ReactNode;
    /** Carries the picker's dot, so the dot leads to the page it is about. */
    marked?: boolean;
}

/** The dot that says a page is new, on the picker and on that page's row. */
const NEW_DOT = { color: StatusColor.INFO, size: 8 } as const;

function useAppPages(): AppPage[] {
    const targetWorkspace = useTargetWorkspace();
    const isVersionManager = useIsVersionManager();
    const isNew = useIsVersionManagerNew();

    const libraries = Object.values(LibraryId).map((libraryId) => ({
        value: libraryId,
        label: getLibraryName(libraryId),
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

    // Only where there is a workspace to push or pull, which is what the page
    // acts on; standalone there is none. Listed while it is showing either way,
    // so the picker cannot end up naming a page it does not offer.
    if (!targetWorkspace && !isVersionManager) {
        return libraries;
    }
    return [
        ...libraries,
        {
            value: VERSION_MANAGER_TAB,
            label: VERSION_MANAGER_LABEL,
            group: UTILITIES_GROUP,
            // What a version is marked with wherever the app shows one.
            icon: GitBranchIcon,
            color: AppColor.VERSION_MANAGER,
            badge: isNew ? (
                <Badge color={AppColor.VERSION_MANAGER}>New</Badge>
            ) : undefined,
            marked: isNew
        }
    ];
}

/**
 * The app's top-level pages: the libraries, and the version manager after them
 * when the panel was opened somewhere it has a document to act on. One page
 * shows at a time, so they are a dropdown naming it rather than a row of tabs
 * — which in Onshape's panel could not lay four names out anyway.
 */
function PagePicker(): ReactNode {
    const pages = useAppPages();
    const isNew = useIsVersionManagerNew();
    const currentLibraryId = useLibraryId();
    const isVersionManager = useIsVersionManager();
    const navigate = useNavigate();

    // Warm the versions on hover, so picking one has nothing left to wait for.
    const prefetchVersions = () => {
        for (const libraryId of Object.values(LibraryId)) {
            void queryClient.prefetchQuery(getLibraryVersionQuery(libraryId));
        }
    };

    const current = isVersionManager ? VERSION_MANAGER_TAB : currentLibraryId;

    const selectPage = (value: string | null) => {
        if (!value || value === current) {
            return;
        }
        if (value === VERSION_MANAGER_TAB) {
            void navigate({ to: "/app/version-manager" });
            return;
        }
        const libraryId = value as LibraryId;
        // Only decides where `/` resumes next time; the url is the source of
        // truth.
        updateUiState({ tabId: libraryId });
        void navigate({
            to: "/app/library/$libraryId",
            params: { libraryId }
        });
    };

    return (
        <PageMenu
            pages={pages}
            current={current}
            // A page worth finding is behind a closed menu, so the menu says so.
            marked={isNew}
            onHover={prefetchVersions}
            onSelect={selectPage}
        />
    );
}

/**
 * The pages under their headings, each heading in the order its first page
 * comes in. The tab row keeps the flat order; only the menu has room to group.
 */
function groupPages(pages: AppPage[]): [string, AppPage[]][] {
    const groups = new Map<string, AppPage[]>();
    for (const page of pages) {
        const group = groups.get(page.group);
        if (group) {
            group.push(page);
        } else {
            groups.set(page.group, [page]);
        }
    }
    return [...groups];
}

interface PageMenuProps {
    pages: AppPage[];
    /** The page showing, which the button names and the menu greys out. */
    current: string;
    /** Dots the button, for a page inside worth pointing out. */
    marked: boolean;
    onHover: () => void;
    onSelect: (value: string) => void;
}

/** The same pages as a dropdown, for a navbar too narrow to lay them in a row. */
function PageMenu(props: PageMenuProps): ReactNode {
    const { pages, current, marked, onHover, onSelect } = props;
    const currentPage = pages.find((page) => page.value === current);

    return (
        <Menu position="bottom-start" withinPortal>
            {/* The dot is around the target rather than the target itself: the
                menu hands its props to whatever it wraps, and that has to be
                the button. The wrapper is what the navbar row lays out, so it
                is the one centred on the row. */}
            <Indicator
                {...NEW_DOT}
                disabled={!marked}
                offset={6}
                my="auto"
                className={styles.noShrink}
            >
                <Menu.Target>
                    <Button
                        variant="subtle"
                        color={StatusColor.NEUTRAL}
                        px="xs"
                        onMouseEnter={onHover}
                        rightSection={<CaretDownIcon size={IconSize.SMALL} />}
                    >
                        {currentPage?.label}
                    </Button>
                </Menu.Target>
            </Indicator>
            <Menu.Dropdown>
                {groupPages(pages).map(([group, groupPages]) => (
                    <MenuSection key={group} label={group}>
                        {groupPages.map((page) => (
                            <Menu.Item
                                key={page.value}
                                disabled={page.value === current}
                                leftSection={
                                    <Indicator
                                        {...NEW_DOT}
                                        disabled={!page.marked}
                                        offset={2}
                                    >
                                        <AppIcon
                                            icon={page.icon}
                                            size={IconSize.MEDIUM}
                                            // The shade an icon reads at; a
                                            // badge wants the name, so its
                                            // light variant tints rather than
                                            // fills.
                                            color={toShade(page.color)}
                                            // A block, so the wrapper is the
                                            // icon's height and not a line's.
                                            style={{ display: "block" }}
                                        />
                                    </Indicator>
                                }
                                onClick={() => onSelect(page.value)}
                            >
                                {/* Beside the name, at the spacing a page
                                    title badges its own with, rather than
                                    across the menu in a right section. */}
                                <Group gap="xs">
                                    {page.label}
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
            variant="subtle"
            color={StatusColor.NEUTRAL}
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

/**
 * How long typing pauses before the search runs. Each query re-searches the
 * index and rebuilds the list, which is enough work to be felt between
 * keystrokes.
 */
const SEARCH_DEBOUNCE_MS = 200;

function SearchBar() {
    const ref = useRef<HTMLInputElement>(null);
    const wasFocused = useRef(false);
    const libraryId = useLibraryId();
    // The box owns what is typed and the stored query follows a pause later, so
    // a keystroke re-renders this input rather than every list reading the query.
    const [query, setQuery] = useState(() => getUiState().searchQuery);
    const runSearch = useDebouncedCallback(
        (value: string) => {
            updateUiState({ searchQuery: value === "" ? undefined : value });
        },
        // Flushed on unmount, so what was typed is what comes back next time.
        { delay: SEARCH_DEBOUNCE_MS, flushOnUnmount: true }
    );

    // `autoFocus` fires before the ref attaches, so onFocus has nothing to select
    // through on the first open and last time's query keeps the caret after it.
    useEffect(() => {
        selectAllInputText(ref);
    }, []);

    const clearButton = query ? (
        <Input.ClearButton
            aria-label="Clear input"
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
            leftSection={<MagnifyingGlassIcon size={IconSize.SMALL} />}
            placeholder={`Search ${getLibraryName(libraryId)}...`}
            ref={ref}
            value={query}
            onFocus={() => {
                selectAllInputText(ref);
            }}
            // A click on an unfocused input focuses it — selecting everything
            // above — and then places the caret on mouseup, which collapses
            // that selection again. Preventing the default only on the click
            // that did the focusing keeps the select-all while leaving a click
            // inside an already-focused field to put the caret where it was
            // aimed.
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
