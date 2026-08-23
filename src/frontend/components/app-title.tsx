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
import { Check, Copy } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { SearchRecord } from "@backend/features/configurations/models";
import { FontWeight, IconSize, TITLE_ICON_NUDGE } from "../lib/style-constants";

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
                    <Text fw={FontWeight.SEMI_BOLD} truncate>
                        {title}
                    </Text>
                    {rightSection}
                </Group>
                {subtitle && (
                    // lh, because the title's own is 1: inheriting that
                    // leaves no leading under the last line, and the block
                    // reads low against a header padded evenly.
                    <Group gap={4} wrap="nowrap" fz="xs" lh="xs" c="dimmed">
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

/** A menu's header: the element is how the part was found, the record is
 * what gets inserted, so both are shown. */
export function MenuTitle(props: MenuTitleProps): ReactNode {
    const { name, record, icon } = props;
    const partName = record?.name !== name ? record?.name : undefined;
    const partNumber =
        record?.partNumber !== name ? record?.partNumber : undefined;
    return (
        <AppTitle
            icon={icon}
            title={name}
            subtitle={
                (partName || partNumber) && (
                    <>
                        {partName && (
                            <Text inherit truncate>
                                {partName}
                            </Text>
                        )}
                        {partName && partNumber && <Text inherit>·</Text>}
                        {partNumber && (
                            <PartNumber
                                partNumber={partNumber}
                                url={record?.url}
                            />
                        )}
                    </>
                )
            }
        />
    );
}

/** The part number, linked to the vendor's page for it when there is one. */
function PartNumber({
    partNumber,
    url
}: {
    partNumber: string;
    url?: string;
}): ReactNode {
    if (!url) {
        return (
            <Text inherit truncate>
                {partNumber}
            </Text>
        );
    }
    return (
        <>
            <Anchor
                href={url}
                target="_blank"
                inherit
                truncate
                onClick={(event) => event.stopPropagation()}
            >
                {partNumber}
            </Anchor>
            <CopyButton value={url}>
                {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy link"} withArrow>
                        <ActionIcon
                            variant="subtle"
                            color={copied ? "teal" : "gray"}
                            size="xs"
                            aria-label="Copy link"
                            onClick={copy}
                        >
                            {copied ? (
                                <Check size={IconSize.TINY} />
                            ) : (
                                <Copy size={IconSize.TINY} />
                            )}
                        </ActionIcon>
                    </Tooltip>
                )}
            </CopyButton>
        </>
    );
}
