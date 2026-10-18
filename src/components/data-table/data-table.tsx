"use client";

import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import * as React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCommonPinningStyles } from "@/lib/data-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  children?: React.ReactNode;
  emptyStateMessage?: string;
  getRowClassName?: (row: TData) => string | undefined;
  // Keep rows where they are when their data changes (e.g. editing the
  // column being sorted on), re-sorting only when the sort itself changes.
  freezeRowOrder?: boolean;
}

// Reorders `rows` to match the last rendered order while the sort is
// unchanged. Rows that weren't there before go at the end, in sorted order.
function useFrozenRowOrder<TData>(
  rows: Row<TData>[],
  sortingKey: string,
  enabled: boolean,
): Row<TData>[] {
  const previousRef = React.useRef<{ sortingKey: string; ids: string[] }>(null);
  const ordered = React.useMemo(() => {
    const previous = previousRef.current;
    if (!enabled || !previous || previous.sortingKey !== sortingKey) {
      return rows;
    }
    const position = new Map(previous.ids.map((id, index) => [id, index]));
    const fallback = previous.ids.length;
    return rows
      .map((row, index) => ({
        row,
        rank: position.get(row.id) ?? fallback + index,
      }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ row }) => row);
  }, [rows, sortingKey, enabled]);

  React.useEffect(() => {
    previousRef.current = { sortingKey, ids: ordered.map((row) => row.id) };
  }, [ordered, sortingKey]);

  return ordered;
}

export function DataTable<TData>({
  table,
  children,
  emptyStateMessage,
  getRowClassName,
  freezeRowOrder = false,
}: DataTableProps<TData>) {
  const rows = useFrozenRowOrder(
    table.getRowModel().rows,
    JSON.stringify(table.getState().sorting),
    freezeRowOrder,
  );

  return (
    <div className="data-table-container space-y-4 relative">
      {children}
      <div className="rounded-md border bg-card shadow-sm relative">
        <div className="relative w-full overflow-x-auto">
          <table className="w-full min-w-[900px] caption-bottom text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const pinningStyles = getCommonPinningStyles(
                      header.column,
                      table,
                    );
                    return (
                      <TableHead
                        key={header.id}
                        style={{
                          ...pinningStyles,
                          position: "sticky",
                          zIndex: (Number(pinningStyles.zIndex) || 0) + 10,
                        }}
                        className="h-12 sticky top-0 bg-card shadow-sm"
                        scope="col"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => {
                  const project = row.original as { status?: string };
                  const hasError =
                    project.status === "errored" ||
                    project.status?.startsWith("invalid");
                  const extraClassName = getRowClassName?.(row.original);
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      aria-selected={row.getIsSelected()}
                      className={cn(
                        extraClassName,
                        hasError &&
                          "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const pinningStyles = getCommonPinningStyles(
                          cell.column,
                          table,
                        );
                        return (
                          <TableCell
                            key={cell.id}
                            style={pinningStyles}
                            className="align-middle"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-24 text-center"
                  >
                    {emptyStateMessage || "No results."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}
