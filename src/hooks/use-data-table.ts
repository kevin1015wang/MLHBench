"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";

interface UseDataTableOptions<TData>
  extends Omit<Partial<TableOptions<TData>>, "onSortingChange"> {
  data: TData[];
  // Notified with the new sorting whenever the table itself changes it
  // (header clicks, table.setSorting). Not called for the returned
  // setSorting, so callers can apply externally-sourced sorting without it
  // echoing back here.
  onSortingChange?: (sorting: SortingState) => void;
  columns: ColumnDef<TData>[];
  initialState?: {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    columnVisibility?: VisibilityState;
    rowSelection?: RowSelectionState;
    columnPinning?: {
      left?: string[];
      right?: string[];
    };
  };
  getRowId?: (row: TData) => string;
}

export function useDataTable<TData>({
  data,
  columns,
  initialState,
  getRowId,
  onSortingChange,
  ...options
}: UseDataTableOptions<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(
    initialState?.sorting ?? [],
  );
  const sortingRef = React.useRef(sorting);
  sortingRef.current = sorting;
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    initialState?.columnFilters ?? [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {},
  );
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sortingRef.current) : updater;
      setSorting(next);
      onSortingChange?.(next);
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getRowId,
    ...options,
  });

  return {
    table,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    rowSelection,
    setRowSelection,
    globalFilter,
    setGlobalFilter,
  };
}
