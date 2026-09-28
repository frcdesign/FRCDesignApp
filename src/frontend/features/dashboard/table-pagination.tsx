import { Group, Pagination } from "@mantine/core";
import { useState, type ReactNode } from "react";

/** Short enough that a page of a dashboard table reads at a glance. */
const ROWS_PER_PAGE = 10;

interface Paged<T> {
    rows: T[];
    page: number;
    pageCount: number;
    setPage: (page: number) => void;
}

/** Clamped rather than reset, so a shorter list lands on its last page without an effect. */
export function usePagedRows<T>(rows: T[]): Paged<T> {
    const [requestedPage, setRequestedPage] = useState(1);

    const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
    const page = Math.min(requestedPage, pageCount);
    const start = (page - 1) * ROWS_PER_PAGE;

    return {
        rows: rows.slice(start, start + ROWS_PER_PAGE),
        page,
        pageCount,
        setPage: setRequestedPage
    };
}

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
