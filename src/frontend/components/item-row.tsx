import { Group, Stack, Table, Text } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import { meaningfulPartNumber } from "@backend/features/configurations/part-number";
import { StatusColor } from "../lib/style-constants";
import { AppContextMenu, MenuButton } from "./app-menu";
import { TruncatedText } from "./truncated-text";
import { PartNumberLink } from "./part-number";
import { mergePositions, type Position } from "../lib/highlight";
import styles from "../lib/styles.module.css";

/** Not `SearchHit`: a favorites row fills this without a query. */
export interface RowMatch {
    /** Where the query matched inside the row's title; empty when none ran. */
    positions: Position[];
    partNumber?: string;
    partName?: string;
    /** The vendor's page for the part number, when one can be derived. */
    url?: string;
    partNumberPositions?: Position[];
    partNamePositions?: Position[];
}

interface CardTitleProps {
    title: string;
    /** The row's `CardThumbnail`, which only the caller knows how to address. */
    thumbnail: ReactNode;
    /** The configuration this row shows, and what a query underlined in it. */
    match?: RowMatch;
    /** Dims the text, for a row that cannot be acted on. */
    disabled?: boolean;
    /** Optional build-status badge rendered after the title. */
    buildStatusBadge?: ReactNode;
}

export function CardTitle(props: CardTitleProps): ReactNode {
    const {
        match,
        title,
        thumbnail,
        buildStatusBadge,
        disabled = false
    } = props;

    return (
        <Group
            gap="sm"
            wrap="nowrap"
            flex={1}
            miw={0}
            className={styles.onlyTextShrinks}
        >
            {thumbnail}
            {/* Shrinks to truncate, but never grows: the badge belongs beside
                the name, not at the row's edge. */}
            <Stack gap={0} miw={0} className={styles.shrinkingText}>
                <TruncatedText
                    hoverText={title}
                    size="sm"
                    c={disabled ? "dimmed" : undefined}
                >
                    <HighlightedText
                        text={title}
                        positions={match?.positions}
                    />
                </TruncatedText>
                {/* The line under the title, so it sits beside it in the stack
                    rather than inside the paragraph the title renders as. */}
                <PartNameAndNumber title={title} match={match} />
            </Stack>
            {buildStatusBadge}
        </Group>
    );
}

interface PartNameAndNumberProps {
    /** The row's own title, which neither line repeats. */
    title: string;
    match?: RowMatch;
}

/** The matched selection's name and part number, beneath the title. */
function PartNameAndNumber(props: PartNameAndNumberProps): ReactNode {
    const { title, match } = props;

    // The match's best selection, minus a value repeating the title.
    const partName =
        match?.partName?.toLowerCase() !== title.toLowerCase()
            ? match?.partName
            : undefined;
    const partNumber = meaningfulPartNumber(match?.partNumber, title);

    if (!partName && !partNumber) {
        return null;
    }

    return (
        <Group
            gap={4}
            wrap="nowrap"
            miw={0}
            fz="xs"
            lh="xs"
            c={StatusColor.DIMMED}
        >
            {partName && (
                <TruncatedText hoverText={partName} inherit miw={0}>
                    <HighlightedText
                        text={partName}
                        positions={match?.partNamePositions}
                    />
                </TruncatedText>
            )}
            {partName && partNumber && <Text inherit>·</Text>}
            {partNumber && (
                <CardPartNumber
                    partNumber={partNumber}
                    positions={match?.partNumberPositions}
                    url={match?.url}
                />
            )}
        </Group>
    );
}

interface CardPartNumberProps {
    partNumber: string;
    /** Where the query matched inside it, for underlining. */
    positions?: Position[];
    url?: string;
}

/** The part number, linked to the vendor's page for it when there is one. */
function CardPartNumber(props: CardPartNumberProps): ReactNode {
    const { partNumber, positions, url } = props;
    const text = <HighlightedText text={partNumber} positions={positions} />;
    if (!url) {
        return (
            <Text
                inherit
                truncate
                miw={0}
                maw="100%"
                className={styles.noShrink}
            >
                {text}
            </Text>
        );
    }
    return (
        <PartNumberLink url={url} noShrink>
            {text}
        </PartNumberLink>
    );
}

/** Render loading, empty and error states outside it. */
export function ItemTable(props: PropsWithChildren): ReactNode {
    return (
        <Table
            highlightOnHover
            verticalSpacing="xs"
            layout="fixed"
            style={{ cursor: "pointer" }}
        >
            <Table.Tbody>{props.children}</Table.Tbody>
        </Table>
    );
}

interface ItemRowProps {
    /** Left content, e.g. a `CardTitle`. */
    left: ReactNode;
    /** Menu items shown on right-click and (when shown) via the "more" button. */
    menuItems: ReactNode;
    onClick?: () => void;
    /** Extra right-aligned controls (e.g. a favorite button or an arrow). */
    rightSection?: ReactNode;
    /** Shows the explicit "..." button that opens the same menu. */
    moreButton?: boolean;
}

/** Render inside an `ItemTable`. */
export function ItemRow(props: ItemRowProps): ReactNode {
    const { left, menuItems, onClick, rightSection, moreButton = true } = props;

    return (
        <AppContextMenu menuItems={menuItems}>
            <Table.Tr onClick={onClick}>
                <Table.Td>
                    <Group wrap="nowrap">
                        {left}
                        <Group
                            gap="4px"
                            justify="flex-end"
                            className={styles.noShrink}
                        >
                            {moreButton && <MenuButton>{menuItems}</MenuButton>}
                            {rightSection}
                        </Group>
                    </Group>
                </Table.Td>
            </Table.Tr>
        </AppContextMenu>
    );
}

interface HighlightedTextProps {
    text: string;
    /** Where the query matched; nothing highlights when absent. */
    positions?: Position[];
}

/** Underlines wherever the query matched inside `text`. */
function HighlightedText(props: HighlightedTextProps): ReactNode {
    const { text, positions = [] } = props;
    const result: ReactNode[] = [];
    let currentIndex = 0;

    // `mergePositions` returns ascending, disjoint runs.
    for (const { start, length } of mergePositions(positions)) {
        const end = start + length;
        if (currentIndex < start) {
            result.push(text.slice(currentIndex, start));
        }
        result.push(<u key={currentIndex}>{text.slice(start, end)}</u>);
        currentIndex = end;
    }

    if (currentIndex < text.length) {
        result.push(text.slice(currentIndex));
    }
    return <>{result}</>;
}
