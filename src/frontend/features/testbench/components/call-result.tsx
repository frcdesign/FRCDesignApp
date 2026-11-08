import { Badge, Code, Group, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { OnshapeCallResult } from "@backend/features/testbench/contract";
import { m } from "../../../paraglide/messages";
import { isLimitHeader } from "../burst";

interface CallResultProps {
    result: OnshapeCallResult;
}

/** Onshape's answer to one call: status, timing, headers and body. */
export function CallResult(props: CallResultProps): ReactNode {
    const { result } = props;
    const limitHeaders = Object.entries(result.headers).filter(([name]) =>
        isLimitHeader(name)
    );
    return (
        <Stack gap="xs">
            <Group gap="xs">
                <StatusBadge status={result.status} />
                <Text size="sm">
                    {m.testbenchDuration({ ms: result.durationMs })}
                </Text>
                <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>
                    {result.url}
                </Text>
            </Group>
            {limitHeaders.length > 0 && (
                <Code block>
                    {limitHeaders
                        .map(([name, value]) => `${name}: ${value}`)
                        .join("\n")}
                </Code>
            )}
            <details>
                <summary>{m.testbenchHeaders()}</summary>
                <Code block>{JSON.stringify(result.headers, null, 2)}</Code>
            </details>
            {result.truncated && (
                <Text size="sm" c="orange">
                    {m.testbenchTruncated()}
                </Text>
            )}
            {result.body !== undefined && (
                <Code block mah={480} style={{ overflow: "auto" }}>
                    {typeof result.body === "string"
                        ? result.body
                        : JSON.stringify(result.body, null, 2)}
                </Code>
            )}
        </Stack>
    );
}

interface StatusBadgeProps {
    status?: number;
}

export function StatusBadge(props: StatusBadgeProps): ReactNode {
    const { status } = props;
    const color =
        status === undefined
            ? "gray"
            : status === 429
              ? "orange"
              : status < 300
                ? "green"
                : "red";
    return <Badge color={color}>{status ?? m.testbenchNoAnswer()}</Badge>;
}
