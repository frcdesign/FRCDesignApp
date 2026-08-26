import { Button, Group, Menu, SegmentedControl, Title } from "@mantine/core";
import { CaretDown } from "@phosphor-icons/react";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { IconSize, PrimaryColor } from "../../lib/style-constants";
import {
    DASHBOARDS,
    DEFAULT_LIBRARY,
    toDashboardKey,
    type DashboardKey
} from "./dashboard-nav";

import frcDesignBook from "/frc-design-book.svg";

/**
 * The dashboard's control row, mirroring the app's navbar: brand, the dashboard
 * selector, and the library it applies to, on the primary-colored bar.
 */
export function DashboardNavbar(): ReactNode {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const current = toDashboardKey(pathname);

    return (
        <Group
            justify="space-between"
            wrap="nowrap"
            gap="sm"
            p="sm"
            bg={PrimaryColor.FILLED}
            c={PrimaryColor.CONTRAST}
        >
            <Group wrap="nowrap" gap="sm" miw={0}>
                <a
                    href="https://frcdesign.org"
                    target="_blank"
                    rel="noreferrer"
                >
                    <img
                        src={frcDesignBook}
                        alt="FRCDesign.org"
                        height={IconSize.CONTROL / 2}
                    />
                </a>
                <Title order={4}>Usage</Title>
                <DashboardSelect current={current} />
            </Group>
            {/* The app dashboard spans every library, so it has none to pick. */}
            {current !== "app" && <LibraryMenu />}
        </Group>
    );
}

/** Switches between the four dashboards, keeping library and range. */
function DashboardSelect({ current }: { current: DashboardKey }): ReactNode {
    const navigate = useNavigate();
    const params = useParams({ strict: false });
    const libraryId = params.libraryId ?? DEFAULT_LIBRARY;

    return (
        <SegmentedControl
            size="sm"
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
            data={DASHBOARDS.map((entry) => ({
                value: entry.key,
                label: entry.label
            }))}
        />
    );
}

/** Repoints the current library-scoped dashboard at another library. */
function LibraryMenu(): ReactNode {
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const params = useParams({ strict: false });
    const current = params.libraryId ?? DEFAULT_LIBRARY;

    const dashboard = DASHBOARDS.find(
        (entry) => entry.key === toDashboardKey(pathname)
    );

    return (
        <Menu position="bottom-end" withinPortal>
            <Menu.Target>
                <Button
                    variant="default"
                    rightSection={<CaretDown size={IconSize.SMALL} />}
                >
                    {getLibraryName(current)}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                {Object.values(LibraryId).map((libraryId) => (
                    <Menu.Item
                        key={libraryId}
                        onClick={() => {
                            // Stay on the same dashboard, just repointed.
                            // The selected part belongs to the old library, so
                            // it cannot carry over.
                            void navigate({
                                to:
                                    dashboard?.to ??
                                    "/dashboard/library/$libraryId",
                                params: { libraryId },
                                search: (prev) => ({
                                    ...prev,
                                    element: undefined
                                })
                            });
                        }}
                    >
                        {getLibraryName(libraryId)}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}
