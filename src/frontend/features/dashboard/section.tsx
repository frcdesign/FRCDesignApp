import { Card, Stack, Title } from "@mantine/core";
import { type ReactNode } from "react";

/** A titled run of the page. */
export function Section({
    title,
    children
}: {
    title: string;
    children: ReactNode;
}): ReactNode {
    return (
        <Stack gap="sm">
            <Title order={3}>{title}</Title>
            {children}
        </Stack>
    );
}

/** A section whose content is one card: a chart, a table, a breakdown. */
export function SectionCard({
    title,
    children
}: {
    title: string;
    children: ReactNode;
}): ReactNode {
    return (
        <Section title={title}>
            <Card withBorder padding="lg" radius="md">
                {children}
            </Card>
        </Section>
    );
}
