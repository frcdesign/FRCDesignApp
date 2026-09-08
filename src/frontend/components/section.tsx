import { Card, Stack, Title, type TitleOrder } from "@mantine/core";
import { type ReactNode } from "react";

interface SectionProps {
    title: string;
    /** Smaller inside a popover than on a page. @default 3 */
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
            <Card withBorder padding="lg" radius="md">
                {children}
            </Card>
        </Section>
    );
}
