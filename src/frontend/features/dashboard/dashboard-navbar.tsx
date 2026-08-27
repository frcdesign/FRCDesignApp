import { ActionIcon, Box, Group, Stack, Tabs, Tooltip } from "@mantine/core";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import {
    BORDER,
    CHROME_BACKGROUND,
    IconSize,
    PrimaryColor
} from "../../lib/style-constants";
import {
    DASHBOARDS,
    DEFAULT_LIBRARY,
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
                bg={CHROME_BACKGROUND}
                style={{ borderBottom: BORDER }}
            >
                <FrcDesignBookIcon />
                <DashboardTabs current={current} />
                <Group gap="xs" wrap="nowrap" ml="auto">
                    <RefreshButton />
                </Group>
            </Group>
            {/* The app dashboard spans every library, so it has none to pick. */}
            {current !== "app" && <LibraryTabs dashboard={current} />}
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
function LibraryTabs({ dashboard }: { dashboard: DashboardKey }): ReactNode {
    const navigate = useNavigate();
    const params = useParams({ strict: false });
    const current = params.libraryId ?? DEFAULT_LIBRARY;

    const target = DASHBOARDS.find((entry) => entry.key === dashboard);

    return (
        <Group
            gap="sm"
            px="sm"
            wrap="nowrap"
            align="stretch"
            style={{ borderBottom: BORDER }}
        >
            <Tabs
                value={current}
                onChange={(value) => {
                    if (!value || value === current) return;
                    void navigate({
                        to: target?.to ?? "/dashboard/library/$libraryId",
                        params: { libraryId: value as LibraryId },
                        // The selected part belongs to the old library.
                        search: (prev) => ({ ...prev, element: undefined })
                    });
                }}
                styles={TAB_STYLES}
            >
                <Tabs.List aria-label="Libraries">
                    {Object.values(LibraryId).map((libraryId) => (
                        <Tabs.Tab key={libraryId} value={libraryId}>
                            {getLibraryName(libraryId)}
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs>
        </Group>
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
                <ArrowsClockwise size={IconSize.MEDIUM} />
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
