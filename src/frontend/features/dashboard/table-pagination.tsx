import { Group, Pagination } from "@mantine/core";
import { type ReactNode } from "react";

interface TablePaginationProps {
    page: number;
    pageCount: number;
    onChange: (page: number) => void;
}

/** The pager under a table; absent while everything fits on one page. */
export function TablePagination({
    page,
    pageCount,
    onChange
}: TablePaginationProps): ReactNode {
    if (pageCount <= 1) {
        return null;
    }

    return (
        <Group justify="center" mt="md">
            <Pagination
                size="sm"
                value={page}
                total={pageCount}
                onChange={onChange}
            />
        </Group>
    );
}
