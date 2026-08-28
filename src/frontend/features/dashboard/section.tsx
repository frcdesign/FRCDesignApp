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

/** The same heading in a card, for a section that is one chart or table. */
export function SectionCard({
    title,
    children
}: {
    title: string;
    children: ReactNode;
}): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Title order={4} mb="md">
                {title}
            </Title>
            {children}
        </Card>
    );
}
