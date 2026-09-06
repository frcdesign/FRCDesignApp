import { Card, Stack, Title } from "@mantine/core";
import { type ReactNode } from "react";

interface SectionProps {
    title: string;
    children: ReactNode;
}

/** A titled run of the page. */
export function Section({ title, children }: SectionProps): ReactNode {
    return (
        <Stack gap="sm">
            <Title order={3}>{title}</Title>
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
