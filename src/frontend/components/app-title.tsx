import { Center, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { SearchRecord } from "@backend/features/configurations/models";
import { FontWeight, TITLE_ICON_NUDGE } from "../lib/style-constants";

interface AppTitleProps {
    title: ReactNode;
    /** Leading icon, at `IconSize.MEDIUM` to match the title's size. */
    icon?: ReactNode;
    /** A quieter second line, e.g. what the current configuration resolves to. */
    subtitle?: ReactNode;
    /** Trailing content on the title's own line, e.g. a status badge. */
    rightSection?: ReactNode;
}

/**
 * The app's heading: one weight and size for every icon-and-text title, so a
 * modal header, an accordion section, and a group header all read alike.
 */
export function AppTitle(props: AppTitleProps): ReactNode {
    const { title, icon, subtitle, rightSection } = props;
    return (
        <Group gap="sm" wrap="nowrap" miw={0}>
            {/* Centred rather than wrapped in a plain box: inside a block the
                icon goes back to sitting on the text baseline, which drops it
                several pixels rather than the one the nudge takes back. */}
            {icon && <Center style={TITLE_ICON_NUDGE}>{icon}</Center>}
            <Stack gap={0} miw={0}>
                <Group gap="xs" wrap="nowrap" miw={0}>
                    <Text fw={FontWeight.SEMI_BOLD} truncate>
                        {title}
                    </Text>
                    {rightSection}
                </Group>
                {subtitle && (
                    <Text size="xs" c="dimmed" truncate>
                        {subtitle}
                    </Text>
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

/**
 * A menu's header. Both names are shown: the element is how the part was found,
 * the record is what actually gets inserted.
 */
export function MenuTitle(props: MenuTitleProps): ReactNode {
    const { name, record, icon } = props;
    const details = record
        ? [record.name, record.partNumber].filter(
              (value): value is string => !!value && value !== name
          )
        : [];
    return (
        <AppTitle
            icon={icon}
            title={name}
            subtitle={details.length > 0 ? details.join(" · ") : undefined}
        />
    );
}
