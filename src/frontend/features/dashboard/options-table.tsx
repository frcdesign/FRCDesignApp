import { Badge, Group, Table, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { UnusedOptionOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { DashboardLink } from "./dashboard-link";
import { formatCount, formatPercent } from "./series-utils";

interface OptionsTableProps {
    libraryId: LibraryId;
    options: UnusedOptionOut[];
    emptyMessage: string;
}

export function OptionsTable({
    libraryId,
    options,
    emptyMessage
}: OptionsTableProps): ReactNode {
    if (options.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                {emptyMessage}
            </Text>
        );
    }

    return (
        <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Part</Table.Th>
                        <Table.Th>Parameter</Table.Th>
                        <Table.Th>Option</Table.Th>
                        <Table.Th ta="right">Uses</Table.Th>
                        <Table.Th ta="right">Share</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {options.map((option) => (
                        <Table.Tr
                            key={`${option.elementId}-${option.parameterId}-${option.value}`}
                        >
                            <Table.Td>
                                <DashboardLink
                                    to="/dashboard/library/$libraryId/part"
                                    params={{ libraryId }}
                                    search={(prev) => ({
                                        ...prev,
                                        element: option.elementId
                                    })}
                                >
                                    {option.partName}
                                </DashboardLink>
                            </Table.Td>
                            <Table.Td>{option.parameterName}</Table.Td>
                            <Table.Td>
                                <Group gap="xs">
                                    {option.label}
                                    {option.count === 0 && (
                                        <Badge color="gray" size="sm">
                                            Never used
                                        </Badge>
                                    )}
                                    {/* A default nobody picks is the strongest
                                        signal the parameter is wrong. */}
                                    {option.isDefault && (
                                        <Badge color="yellow" size="sm">
                                            Default
                                        </Badge>
                                    )}
                                </Group>
                            </Table.Td>
                            <Table.Td ta="right">
                                {formatCount(option.count)}
                            </Table.Td>
                            <Table.Td ta="right" c="dimmed">
                                {option.parameterTotal === 0
                                    ? "—"
                                    : formatPercent(
                                          option.count,
                                          option.parameterTotal
                                      )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    );
}
