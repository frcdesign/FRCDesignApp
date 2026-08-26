import { Anchor, Badge, Group, Table, Text } from "@mantine/core";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { DashboardLink } from "./dashboard-link";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { makeUrl } from "../../lib/url";
import { IconSize } from "../../lib/style-constants";
import { formatCount, formatDate } from "./series-utils";

interface PartsTableProps {
    libraryId: LibraryId;
    parts: PartUsageOut[];
    /** Shown in place of the table when there is nothing to list. */
    emptyMessage: string;
}

export function PartsTable({
    libraryId,
    parts,
    emptyMessage
}: PartsTableProps): ReactNode {
    if (parts.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                {emptyMessage}
            </Text>
        );
    }

    return (
        <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Part</Table.Th>
                        <Table.Th>Group</Table.Th>
                        <Table.Th ta="right">Insertions</Table.Th>
                        <Table.Th>Last used</Table.Th>
                        <Table.Th>Onshape</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {parts.map((part) => (
                        <PartRow
                            key={part.elementId}
                            libraryId={libraryId}
                            part={part}
                        />
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    );
}

function PartRow({
    libraryId,
    part
}: {
    libraryId: LibraryId;
    part: PartUsageOut;
}): ReactNode {
    return (
        <Table.Tr>
            <Table.Td>
                <Group gap="xs">
                    <DashboardLink
                        to="/dashboard/library/$libraryId/part"
                        params={{ libraryId }}
                        search={(prev) => ({
                            ...prev,
                            element: part.elementId
                        })}
                    >
                        {part.name ?? part.elementId}
                    </DashboardLink>
                    {part.name === null && (
                        <Badge color="gray" size="sm">
                            Removed
                        </Badge>
                    )}
                </Group>
            </Table.Td>
            <Table.Td>{part.groupName ?? "—"}</Table.Td>
            <Table.Td ta="right">{formatCount(part.insertCount)}</Table.Td>
            <Table.Td>{formatDate(part.lastInsertedAt)}</Table.Td>
            <Table.Td>
                {part.documentId && part.versionId ? (
                    <Anchor
                        href={makeUrl({
                            documentId: part.documentId,
                            instanceId: part.versionId,
                            instanceType: "v",
                            elementId: part.elementId
                        })}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <ArrowSquareOut size={IconSize.SMALL} />
                    </Anchor>
                ) : (
                    "—"
                )}
            </Table.Td>
        </Table.Tr>
    );
}
