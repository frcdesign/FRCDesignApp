import { Card, Stack, Title, type TitleOrder } from "@mantine/core";
import { type ReactNode } from "react";

/** A section's title inside a popover or menu: the size of the text under it, set apart by weight. */
export const PANEL_TITLE_ORDER: TitleOrder = 6;

interface SectionProps {
    title: string;
    /** {@link PANEL_TITLE_ORDER} inside a popover or menu. @default 3 */
    order?: TitleOrder;
    children: ReactNode;
}

/** A titled run of a page or a menu. */
export function Section({
    title,
    order = 3,
    children
}: SectionProps): ReactNode {
    return (
        <Stack gap="sm">
            <Title order={order}>{title}</Title>
            {children}
        </Stack>
    );
}

interface SectionCardProps {
    title: string;
    children: ReactNode;
}

/** A section whose content is one card: a chart, a table, a breakdown. */
export function SectionCard({ title, children }: SectionCardProps): ReactNode {
    return (
        <Section title={title}>
            <Card>{children}</Card>
        </Section>
    );
}
