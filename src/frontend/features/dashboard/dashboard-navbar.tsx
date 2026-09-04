import {
    ActionIcon,
    Box,
    Button,
    Group,
    Menu,
    NumberInput,
    Stack,
    Text,
    Tabs,
    Tooltip
} from "@mantine/core";
import { ArrowClockwise, CaretDown } from "@phosphor-icons/react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    useNavigate,
    useParams,
    useRouterState,
    useSearch
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import {
    BORDER,
    FRAME_BACKGROUND,
    IconSize,
    PrimaryColor
} from "../../lib/style-constants";
import { DashboardSettingsMenu } from "./dashboard-settings";
import { RangeControl } from "./range-control";
import { getOverviewQuery } from "./dashboard-queries";
import { toDayRange } from "./range";
import { formatDay } from "./series-utils";
import {
    DASHBOARDS,
    DEFAULT_LIBRARY,
    DEFAULT_THRESHOLD,
    toDashboardKey,
    type DashboardKey
} from "./dashboard-nav";

import frcDesignBook from "/frc-design-book.svg";

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
                wrap="nowrap"
                align="stretch"
                bg={FRAME_BACKGROUND}
                style={{ borderBottom: BORDER }}
            >
                <FrcDesignBookIcon />
                <DashboardTabs current={current} />
                <Group gap="xs" wrap="nowrap" ml="auto">
                    <RefreshButton />
                    <DashboardSettingsMenu />
                </Group>
            </Group>
            <Group
                gap="sm"
                px="sm"
                py="xs"
                wrap="nowrap"
                align="center"
                style={{ borderBottom: BORDER }}
            >
                {/* The app dashboard spans every library, so it has none to
                    pick; the range still applies to it. */}
                {current === "app" ? (
                    <TrackingSince />
                ) : (
                    <LibraryMenu dashboard={current} />
                )}
                {/* Every library-scoped dashboard counts over the range; the
                    app dashboard's cards each state their own window. */}
                {current !== "app" && (
                    <Group gap="sm" ml="auto">
                        {current === "unused" && <ThresholdControl />}
                        <RangeControl />
                    </Group>
                )}
            </Group>
        </Stack>
    );
}

/** Switches between the four dashboards, keeping library and range. */
function DashboardTabs({ current }: { current: DashboardKey }): ReactNode {
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
                    params: { libraryId },
                    search: (prev) => prev
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

/** Repoints the current library-scoped dashboard at another library. */
function LibraryMenu({ dashboard }: { dashboard: DashboardKey }): ReactNode {
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
                    rightSection={<CaretDown size={IconSize.SMALL} />}
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
                                // The part belongs to the old library.
                                search: (prev) => ({
                                    ...prev,
                                    element: undefined
                                })
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
    const threshold = useSearch({ strict: false }).threshold;

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
                    search: (prev) => ({
                        ...prev,
                        threshold:
                            typeof value === "number"
                                ? value
                                : DEFAULT_THRESHOLD
                    })
                })
            }
        />
    );
}

/** Wide enough for the "Uses ≤" prefix to sit clear of the number. */
const THRESHOLD_LABEL_WIDTH = 52;

/**
 * How much history there is.
 *
 * Worth more than a window picker on a dataset this new: every empty
 * comparison on the page is explained by this one date.
 */
function TrackingSince(): ReactNode {
    const { data } = useQuery(getOverviewQuery(toDayRange("all")));
    if (!data?.trackingSince) return null;
    return (
        <Text size="xs" c="dimmed" my="auto">
            Tracking since {formatDay(data.trackingSince)}
        </Text>
    );
}

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
                <ArrowClockwise size={IconSize.MEDIUM} />
            </ActionIcon>
        </Tooltip>
    );
}

const TAB_STYLES = {
    // Hides the line under the tab list alone; the row owns one that spans it.
    root: { "--tab-border-color": "transparent" },
    list: { flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" },
    // Pulled onto that divider, so the active tab's indicator replaces it.
    tab: { marginBottom: -1, paddingInline: "var(--mantine-spacing-sm)" }
} as const;

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
