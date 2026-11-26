import {
    Card,
    Group,
    Stack,
    Text,
    Title,
    type TitleOrder
} from "@mantine/core";
import { type ReactNode } from "react";

/** A section's title inside a popover or menu: the size of the text under it, set apart by weight. */
export const PANEL_TITLE_ORDER: TitleOrder = 6;

interface SectionProps {
    title: string;
    /** {@link PANEL_TITLE_ORDER} inside a popover or menu. @default 3 */
    order?: TitleOrder;
    /** Beside the title, dimmed: what the section covers, such as its time range. */
    caption?: string;
    /** At the far end of the title's row: a control for the section alone. */
    aside?: ReactNode;
    children: ReactNode;
}

/** A titled run of a page or a menu. */
export function Section({
    title,
    order = 3,
    caption,
    aside,
    children
}: SectionProps): ReactNode {
    const heading = <Title order={order}>{title}</Title>;
    return (
        <Stack gap="sm">
            {caption === undefined && aside === undefined ? (
                heading
            ) : (
                // A control that doesn't fit beside the title wraps below it; the title never shrinks.
                <Group
                    justify="space-between"
                    wrap="wrap"
                    preventGrowOverflow={false}
                >
                    <Group gap="xs" align="baseline" style={{ flexShrink: 0 }}>
                        {heading}
                        {caption && <Text c="dimmed">{caption}</Text>}
                    </Group>
                    {aside}
                </Group>
            )}
            {children}
        </Stack>
    );
}

interface SectionCardProps {
    title: string;
    caption?: string;
    aside?: ReactNode;
    children: ReactNode;
}

/** A section whose content is one card: a chart, a table, a breakdown. */
export function SectionCard({
    title,
    caption,
    aside,
    children
}: SectionCardProps): ReactNode {
    return (
        <Section title={title} caption={caption} aside={aside}>
            <Card>{children}</Card>
        </Section>
    );
}
