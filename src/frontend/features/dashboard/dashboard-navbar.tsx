import {
    ActionIcon,
    Button,
    Group,
    Menu,
    NumberInput,
    Stack,
    Text,
    Tabs,
    Tooltip
} from "@mantine/core";
import { ArrowClockwiseIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
    useNavigate,
    useParams,
    useRouterState,
    useSearch
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../../lib/library";
import {
    BORDER,
    FRAME_BACKGROUND,
    IconSize,
    NAVBAR_ROW_HEIGHT
} from "../../lib/style-constants";
import { AppBrand } from "../../components/app-brand";
import { SettingsButton } from "../../components/app-navbar";
import { RangeControl } from "./range-control";
import {
    DASHBOARDS,
    DEFAULT_LIBRARY,
    DEFAULT_THRESHOLD,
    toDashboardKey,
    type DashboardKey
} from "./dashboard-nav";

interface DashboardTabsProps {
    current: DashboardKey;
}

/**
 * Two tiers, like the panel's navbar: the dashboard over the library it reads.
 */
export function DashboardNavbar(): ReactNode {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const current = toDashboardKey(pathname);

    return (
        <Stack gap={0}>
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
                <DashboardTabs current={current} />
                <Group gap="xs" wrap="nowrap" ml="auto">
                    <RefreshButton />
                    <SettingsButton />
                </Group>
            </Group>
            {/* Only the library-scoped dashboards have anything to put here:
                the app dashboard spans every library, and its cards each state
                their own window. */}
            {current !== "app" && (
                <Group
                    gap="sm"
                    px="sm"
                    h={NAVBAR_ROW_HEIGHT}
                    wrap="nowrap"
                    align="center"
                    style={{ borderBottom: BORDER }}
                >
                    <LibraryMenu dashboard={current} />
                    <Group gap="sm" ml="auto">
                        {current === "unused" && <ThresholdControl />}
                        <RangeControl />
                    </Group>
                </Group>
            )}
        </Stack>
    );
}

/** Switches between the four dashboards, keeping library and range. */
function DashboardTabs({ current }: DashboardTabsProps): ReactNode {
    const navigate = useNavigate();
    const params = useParams({ strict: false });
    const libraryId = params.libraryId ?? DEFAULT_LIBRARY;

    return (
        <Tabs
            value={current}
            onChange={(value) => {
                const target = DASHBOARDS.find((entry) => entry.key === value);
                if (!target) return;
                void navigate({
                    to: target.to,
                    // Harmless on the app dashboard, which ignores it.
                    params: { libraryId }
                });
            }}
            styles={TAB_STYLES}
        >
            <Tabs.List aria-label="Dashboards">
                {DASHBOARDS.map((entry) => (
                    <Tabs.Tab key={entry.key} value={entry.key}>
                        {entry.label}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
        </Tabs>
    );
}

interface LibraryMenuProps {
    dashboard: DashboardKey;
}

/** Repoints the current library-scoped dashboard at another library. */
function LibraryMenu({ dashboard }: LibraryMenuProps): ReactNode {
    const navigate = useNavigate();
    const params = useParams({ strict: false });
    const current = params.libraryId ?? DEFAULT_LIBRARY;

    const target = DASHBOARDS.find((entry) => entry.key === dashboard);

    return (
        <Menu position="bottom-start" withinPortal>
            <Menu.Target>
                <Button
                    variant="default"
                    size="compact-sm"
                    rightSection={<CaretDownIcon size={IconSize.SMALL} />}
                >
                    {getLibraryName(current)}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                {Object.values(LibraryId).map((libraryId) => (
                    <Menu.Item
                        key={libraryId}
                        disabled={libraryId === current}
                        onClick={() =>
                            void navigate({
                                to:
                                    target?.to ??
                                    "/dashboard/library/$libraryId",
                                params: { libraryId },
                                // Dropped, not retained: the part being
                                // reported on belongs to the old library.
                                search: { element: undefined }
                            })
                        }
                    >
                        {getLibraryName(libraryId)}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

/** The cutoff the low-usage dashboard lists at or below. */
function ThresholdControl(): ReactNode {
    const navigate = useNavigate();
    const search = useSearch({ strict: false });
    const threshold = search.threshold;

    return (
        <NumberInput
            size="xs"
            w={140}
            min={0}
            leftSection={
                <Text size="xs" c="dimmed" ml="xs">
                    Uses ≤
                </Text>
            }
            leftSectionWidth={THRESHOLD_LABEL_WIDTH}
            aria-label="Low-usage threshold"
            value={threshold ?? DEFAULT_THRESHOLD}
            onChange={(value) =>
                void navigate({
                    to: ".",
                    search: {
                        threshold:
                            typeof value === "number"
                                ? value
                                : DEFAULT_THRESHOLD
                    }
                })
            }
        />
    );
}

/** Wide enough for the "Uses ≤" prefix to sit clear of the number. */
const THRESHOLD_LABEL_WIDTH = 52;

/** Refetches whatever the current dashboard is showing. */
function RefreshButton(): ReactNode {
    const queryClient = useQueryClient();
    const fetching = useIsFetching({ queryKey: ["analytics"] }) > 0;

    return (
        <Tooltip withArrow label="Refresh">
            <ActionIcon
                my="auto"
                variant="subtle"
                color="gray"
                aria-label="Refresh"
                loading={fetching}
                onClick={() =>
                    void queryClient.invalidateQueries({
                        queryKey: ["analytics"]
                    })
                }
            >
                <ArrowClockwiseIcon size={IconSize.MEDIUM} />
            </ActionIcon>
        </Tooltip>
    );
}

const TAB_STYLES = {
    // Hides the line under the tab list alone; the row owns one that spans it.
    root: { "--tab-border-color": "transparent", minWidth: 0 },
    // Full height, so the underline lands on the row's border rather than
    // partway up a taller bar.
    list: {
        height: "100%",
        flexWrap: "nowrap",
        overflowX: "auto",
        scrollbarWidth: "none"
    },
    // Pulled onto that divider, so the active tab's indicator replaces it.
    tab: { marginBottom: -1, paddingInline: "var(--mantine-spacing-sm)" }
} as const;
