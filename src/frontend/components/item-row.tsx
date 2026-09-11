/**
 * The anatomy of a list row, shared by the library, favorites and search: the
 * table that holds rows, a row itself, and the title block inside it.
 */
import { Group, Stack, Table, Text } from "@mantine/core";
import { EyeSlashIcon } from "@phosphor-icons/react";
import { PropsWithChildren, ReactNode } from "react";
import { meaningfulPartNumber } from "@backend/features/configurations/part-number";
import { IconSize, NO_SHRINK, StatusColor } from "../lib/style-constants";
import { AppContextMenu, MenuButton } from "./app-menu";
import { AppIcon } from "./app-icon";
import { TruncatedText } from "./truncated-text";
import { PartNumberLink } from "./part-number";
import { mergePositions, type Position } from "../lib/highlight";

/**
 * What a row shows about the query that found it. Structural rather than the
 * search feature's own `SearchHit`: a row displays a match, it does not search.
 */
export interface RowMatch {
    /** Where the query matched inside the row's title. */
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
    /** Set when the row was found by a search, to underline what matched. */
    match?: RowMatch;
    /** Dims the text, for a row that cannot be acted on. */
    disabled?: boolean;
    /** Marks a row only an editor can see. */
    showHiddenTag?: boolean;
    /** Optional build-status badge rendered after the title. */
    buildStatusBadge?: ReactNode;
}

export function CardTitle(props: CardTitleProps): ReactNode {
    const {
        match,
        title,
        thumbnail,
        buildStatusBadge,
        disabled = false,
        showHiddenTag = false
    } = props;

    return (
        <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
            {thumbnail}
            {/* Shrinks to truncate, but never grows: the badge and hidden tag
                belong beside the name, not at the row's edge. */}
            <Stack gap={0} miw={0}>
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
            {/* After the badge: toggling visibility would otherwise shift the
                badge, dragging its open hover card out from under the cursor. */}
            {showHiddenTag && (
                <AppIcon
                    icon={EyeSlashIcon}
                    size={IconSize.SMALL}
                    color={StatusColor.WARNING}
                    label="Hidden"
                />
            )}
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
            <Text inherit truncate miw={0} maw="100%" style={NO_SHRINK}>
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

/**
 * Groups `ItemRow`s into a single dense, hoverable table. Loading/empty/error
 * states should be rendered outside of this.
 */
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

/**
 * A clickable table row with a hover state and a right-click context menu.
 * Used for documents, insertables, and favorites. Render inside an `ItemTable`.
 */
export function ItemRow(props: ItemRowProps): ReactNode {
    const { left, menuItems, onClick, rightSection, moreButton = true } = props;

    return (
        <AppContextMenu menuItems={menuItems}>
            <Table.Tr onClick={onClick}>
                <Table.Td>
                    <Group wrap="nowrap">
                        {left}
                        <Group gap="4px" justify="flex-end">
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

    // `mergePositions` walks an index map upward, so its runs come out
    // ascending and disjoint; this reads the string in one pass on that.
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
