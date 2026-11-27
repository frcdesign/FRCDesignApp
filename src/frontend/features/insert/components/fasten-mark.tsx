import { Box, Tooltip } from "@mantine/core";
import { PlugsConnectedIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type InsertableOut } from "@backend/features/library/contract";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import styles from "../../../lib/styles.module.css";
import { useFastenPicks } from "../fasten-picks";
import { useCanFasten } from "../insert-hooks";

interface FastenMarkProps {
    insertable: InsertableOut;
}

/** Beside a part that can insert and fasten: filled in Preselection's blue while picks are held for it. */
export function FastenMark(props: FastenMarkProps): ReactNode {
    const canFasten = useCanFasten(props.insertable);
    const pickCount = useFastenPicks((state) => state.targets.length);
    if (!canFasten) {
        return null;
    }
    const hasPicks = pickCount > 0;
    return (
        <Tooltip
            label={
                hasPicks
                    ? m.fastenMarkPicks({ count: pickCount })
                    : m.fastenMarkNoPicks()
            }
        >
            <Box
                c={
                    hasPicks
                        ? "var(--mantine-primary-color-filled)"
                        : StatusColor.DIMMED
                }
                className={`${styles.noShrink} ${styles.block}`}
                data-has-picks={hasPicks || undefined}
            >
                <PlugsConnectedIcon
                    size={IconSize.SMALL}
                    weight={hasPicks ? "fill" : "regular"}
                    className={styles.block}
                />
            </Box>
        </Tooltip>
    );
}
