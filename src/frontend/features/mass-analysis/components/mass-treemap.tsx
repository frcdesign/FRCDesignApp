import { type ReactNode } from "react";
import { type MassNode } from "@backend/features/mass-analysis/contract";
import { AppTreemap } from "../../../components/app-treemap";
import { AppBreadcrumbs } from "../../../components/breadcrumbs";
import { SectionNotice } from "../../../components/app-notice";
import { AppColor } from "../../../theme";
import { m } from "../../../paraglide/messages";
import { canOpen, type MassLevel, toTiles, type MassTile } from "../mass-data";

interface MassTreemapProps {
    level: MassLevel;
    /** The ids of the subassemblies to open, outermost first. */
    onOpen: (path: string[]) => void;
}

/** Tall enough that the smaller parts still get a readable tile. */
const CHART_HEIGHT = 360;

/** The level's items by mass; a subassembly that isn't a library's opens into its own. */
export function MassTreemap({ level, onOpen }: MassTreemapProps): ReactNode {
    const tiles = toTiles(level.children, AppColor.MASS_ANALYSIS);
    const total = tiles.reduce((sum, tile) => sum + tile.value, 0);
    const openedIds = level.trail.map((assembly) => assembly.id);

    const select = (tile: MassTile): void => {
        const node = level.children.find(
            (child: MassNode) => child.id === tile.id
        );
        if (node && canOpen(node)) {
            onOpen([...openedIds, node.id]);
        }
    };

    return (
        <>
            {level.trail.length > 0 && (
                // Spaced off the chart below, which otherwise sits on the trail.
                <AppBreadcrumbs
                    mb="sm"
                    crumbs={[
                        {
                            label: m.massAnalysisTopLevel(),
                            onClick: () => onOpen([])
                        },
                        ...level.trail.slice(0, -1).map((assembly, index) => ({
                            label: assembly.name,
                            onClick: () => onOpen(openedIds.slice(0, index + 1))
                        }))
                    ]}
                    current={level.trail[level.trail.length - 1].name}
                />
            )}
            {tiles.length === 0 ? (
                <SectionNotice title={m.massAnalysisChartEmpty()} />
            ) : (
                <AppTreemap
                    nodes={tiles}
                    h={CHART_HEIGHT}
                    valueFormatter={(pounds) =>
                        m.massAnalysisShare({
                            mass: pounds,
                            share: pounds / total
                        })
                    }
                    onSelect={select}
                />
            )}
        </>
    );
}
