import { useEffect, useMemo, useState } from "react";

interface UsePaginationOptions {
    pageSize?: number;
    initialPage?: number;
    resetOnItemsChange?: boolean;
}

interface UsePaginationResult<T> {
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
    totalItems: number;
    pagedItems: T[];
    safePage: number;
    goPrev: () => void;
    goNext: () => void;
    goTo: (p: number) => void;
}

/**
 * Generic pagination hook: slices an array and provides navigation.
 * - Clamps page to valid range if items change.
 * - Optionally resets to page 1 on items change.
 */
export function usePagination<T>(
    items: T[],
    {
        pageSize = 3,
        initialPage = 1,
        resetOnItemsChange = false,
    }: UsePaginationOptions = {}
): UsePaginationResult<T> {
    const [page, setPage] = useState(initialPage);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // If items change, clamp or optionally reset to page 1
    useEffect(() => {
        if (resetOnItemsChange) {
            setPage(1);
        } else {
            setPage((p) => Math.min(Math.max(1, p), totalPages));
        }
    }, [totalItems, totalPages, resetOnItemsChange]);

    const safePage = Math.min(Math.max(1, page), totalPages);

    const pagedItems = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        
        return items.slice(start, start + pageSize);
    }, [items, safePage, pageSize]);

    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
    const goTo = (p: number) =>
        setPage(Math.min(Math.max(1, Math.floor(p)), totalPages));

    return {
        page,
        setPage,
        totalPages,
        totalItems,
        pagedItems,
        safePage,
        goPrev,
        goNext,
        goTo,
    };
}
