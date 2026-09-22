import { Badge, Group, Table, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import type {
    ConfigurationValueUsage,
    UnusedOptionOut
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { StatusColor } from "../../lib/style-constants";
import { formatCount, formatFraction } from "./format";
import { ImplicitDefaultBadge } from "./implicit-default";
import { ParameterPath } from "./parameter-path";
import { TablePagination, usePagedRows } from "./table-pagination";

/** Below this the part and parameter names wrap into each other. */
const MIN_TABLE_WIDTH = 760;

const COLUMNS = ["Part", "Parameter", "Option", "Uses", "Share"];

/** The last two columns are counts, which read right-aligned. */
const NUMERIC_COLUMNS = 2;

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
    const paged = usePagedRows(options);

    if (options.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                {emptyMessage}
            </Text>
        );
    }

    return (
        <>
            <Table.ScrollContainer minWidth={MIN_TABLE_WIDTH}>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            {COLUMNS.map((column, index) => (
                                <Table.Th
                                    key={column}
                                    ta={
                                        index >=
                                        COLUMNS.length - NUMERIC_COLUMNS
                                            ? "right"
                                            : undefined
                                    }
                                >
                                    {column}
                                </Table.Th>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {paged.rows.map((option) => (
                            <OptionRow
                                key={`${option.path.elementId}-${option.parameterId}-${option.parameterPath.join(">")}-${option.value.value}`}
                                libraryId={libraryId}
                                option={option}
                            />
                        ))}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
            <TablePagination
                page={paged.page}
                pageCount={paged.pageCount}
                onChange={paged.setPage}
            />
        </>
    );
}

interface OptionRowProps {
    libraryId: LibraryId;
    option: UnusedOptionOut;
}

/** Clicking the row opens the part, as the parts table's rows do. */
function OptionRow({ libraryId, option }: OptionRowProps): ReactNode {
    const navigate = useNavigate();

    return (
        <Table.Tr
            style={{ cursor: "pointer" }}
            onClick={() =>
                void navigate({
                    to: "/dashboard/library/$libraryId/part",
                    params: { libraryId },
                    search: { element: option.path.elementId }
                })
            }
        >
            <Table.Td>{option.partName}</Table.Td>
            <Table.Td>
                <Group gap="xs" wrap="nowrap">
                    <ParameterPath path={option.parameterPath} />
                    {option.parameterName}
                </Group>
            </Table.Td>
            <Table.Td>
                <OptionLabel value={option.value} />
            </Table.Td>
            <Table.Td ta="right">{formatCount(option.value.count)}</Table.Td>
            <Table.Td ta="right" c="dimmed">
                {formatFraction(option.value.count, option.parameterTotal)}
            </Table.Td>
        </Table.Tr>
    );
}

interface OptionLabelProps {
    value: ConfigurationValueUsage;
}

/** The option, badged with what makes it worth listing. */
function OptionLabel({ value }: OptionLabelProps): ReactNode {
    return (
        <Group gap="xs">
            {value.label}
            {value.count === 0 && (
                <Badge color={StatusColor.INFO} size="sm">
                    Never used
                </Badge>
            )}
            {/* A default nobody picks is the strongest signal the parameter
                is wrong. An implicit one is stronger still: it is what this
                branch lands on without anyone having declared it. */}
            {value.isImplicitDefault && (
                <ImplicitDefaultBadge color={StatusColor.WARNING} size="sm" />
            )}
            {value.isDefault && (
                <Badge color={StatusColor.WARNING} size="sm">
                    Default
                </Badge>
            )}
        </Group>
    );
}
