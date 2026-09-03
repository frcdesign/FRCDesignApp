import {
    ActionIcon,
    Anchor,
    Center,
    CopyButton,
    Group,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import { ArrowSquareOutIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";
import { modals } from "@mantine/modals";
import type { SearchRecord } from "@backend/features/configurations/models";
import {
    FontWeight,
    IconSize,
    StatusColor,
    TITLE_ICON_NUDGE
} from "../lib/style-constants";
import { meaningfulPartNumber } from "@backend/features/configurations/part-number";

interface AppTitleProps {
    title: ReactNode;
    /** Leading icon, at `IconSize.MEDIUM` to match the title's size. */
    icon?: ReactNode;
    /** A quieter second line, laid out as a row so it can hold controls. */
    subtitle?: ReactNode;
    /** Trailing content on the title's own line, e.g. a status badge. */
    rightSection?: ReactNode;
}

/** One weight and size for every icon-and-text heading in the app. */
export function AppTitle(props: AppTitleProps): ReactNode {
    const { title, icon, subtitle, rightSection } = props;
    return (
        <Group gap="sm" wrap="nowrap" miw={0}>
            {/* Centred, not wrapped in a block, where the icon would go back
                to sitting on the text baseline several pixels low. */}
            {icon && <Center style={TITLE_ICON_NUDGE}>{icon}</Center>}
            <Stack gap={0} miw={0}>
                <Group gap="xs" wrap="nowrap" miw={0}>
                    <Text fw={FontWeight.SEMI_BOLD} truncate miw={0}>
                        {title}
                    </Text>
                    {rightSection}
                </Group>
                {subtitle && (
                    // lh, because inheriting the title's 1 leaves no leading
                    // under the last line, reading low in an evenly padded header.
                    <Group
                        gap={4}
                        wrap="nowrap"
                        // Shrinkable, so a part number long enough to overrun
                        // the header ellipsizes instead.
                        miw={0}
                        fz="xs"
                        lh="xs"
                        c={StatusColor.DIMMED}
                    >
                        {subtitle}
                    </Group>
                )}
            </Stack>
        </Group>
    );
}

interface MenuTitleProps {
    name: string;
    /** The configuration in view, which names the part the element resolves to. */
    record?: SearchRecord;
    icon?: ReactNode;
}

/** A menu's header: the element name is how the part was found, the part
 * number is what identifies what gets inserted. */
export function MenuTitle(props: MenuTitleProps): ReactNode {
    const { name, record, icon } = props;
    const partNumber = meaningfulPartNumber(record?.partNumber, name);
    return (
        <AppTitle
            icon={icon}
            title={name}
            subtitle={
                partNumber && (
                    <PartNumber partNumber={partNumber} url={record?.url} />
                )
            }
        />
    );
}

interface UseMenuTitleProps extends Omit<MenuTitleProps, "name"> {
    /** Undefined until known, which leaves the title the opener set. */
    name: string | undefined;
}

/**
 * Keeps a modal's header on the selection in view. The header is updated rather
 * than rendered, being the modal's rather than the content's.
 */
export function useMenuTitle(modalId: string, props: UseMenuTitleProps): void {
    const { name, record, icon } = props;
    useEffect(() => {
        if (name === undefined) {
            return;
        }
        modals.updateModal({
            modalId,
            title: <MenuTitle name={name} record={record} icon={icon} />
        });
    }, [modalId, name, record, icon]);
}

/** The xs line box the subtitle row is otherwise sized by, floored. */
const COPY_BUTTON_SIZE = 16;

/** The part number, linked to the vendor's page for it when there is one. */
interface PartNumberProps {
    partNumber: string;
    url?: string;
}

function PartNumber(props: PartNumberProps): ReactNode {
    const { partNumber, url } = props;
    // Nowhere to send them, so offer the number itself to search with.
    if (!url) {
        return (
            <>
                <Text inherit truncate miw={0}>
                    {partNumber}
                </Text>
                <CopyButton value={partNumber}>
                    {({ copied, copy }) => (
                        <Tooltip
                            label={copied ? "Copied" : "Copy part number"}
                            withArrow
                        >
                            <ActionIcon
                                variant="subtle"
                                color={copied ? "teal" : "gray"}
                                // Sized to the text line: taller, and the row
                                // grows, shifting the title above it.
                                size={COPY_BUTTON_SIZE}
                                aria-label="Copy part number"
                                onClick={copy}
                            >
                                {copied ? (
                                    <CheckIcon size={IconSize.TINY} />
                                ) : (
                                    <CopyIcon size={IconSize.TINY} />
                                )}
                            </ActionIcon>
                        </Tooltip>
                    )}
                </CopyButton>
            </>
        );
    }
    return (
        // inline-flex so the icon centres on the text rather than sitting on
        // its baseline, and takes the link's color by being inside it.
        <Anchor
            href={url}
            target="_blank"
            inherit
            onClick={(event) => event.stopPropagation()}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                minWidth: 0
            }}
        >
            <Text component="span" inherit truncate miw={0}>
                {partNumber}
            </Text>
            <ArrowSquareOutIcon size={IconSize.TINY} />
        </Anchor>
    );
}
