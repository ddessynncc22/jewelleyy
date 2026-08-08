import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from "lucide-react";
import LoadingSkeleton from "./LoadingSkeleton";
import Pagination from "./Pagination";

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  pagination,
  filters: FiltersComponent,
  onSort,
  onRowClick,
  rowClassName,
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const handleSort = (colKey) => {
    if (!colKey) return;
    let dir = "asc";
    if (sortColumn === colKey) dir = sortDirection === "asc" ? "desc" : "asc";
    setSortColumn(colKey);
    setSortDirection(dir);
    onSort?.({ column: colKey, direction: dir });
  };

  const SortIcon = ({ colKey }) => {
    if (sortColumn !== colKey)
      return <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-ink-300)]" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-[var(--color-gold-600)]" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-[var(--color-gold-600)]" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {FiltersComponent && <div>{FiltersComponent}</div>}
        <LoadingSkeleton count={5} type="table" />
      </div>
    );
  }
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="space-y-4 animate-fade-in">
      {FiltersComponent && <div>{FiltersComponent}</div>}

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)]">
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[var(--color-primary-bg)]/70">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] ${col.sortable !== false ? "cursor-pointer select-none hover:text-[var(--color-text)]" : ""}`}
                    onClick={() =>
                      col.sortable !== false && handleSort(col.key)
                    }
                  >
                    <div className="inline-flex items-center gap-1.5">
                      {col.label}
                      {col.sortable !== false && <SortIcon colKey={col.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-card)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-bg)]">
                        <Inbox className="h-6 w-6 text-[var(--color-gold-600)]" />
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        No data found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr
                    key={row._id || rowIndex}
                    className={`transition-colors hover:bg-[var(--color-ink-50)] ${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row) || ""}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="whitespace-nowrap px-4 py-3 text-sm text-[var(--color-text)]"
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden divide-y divide-[var(--color-border)]">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-bg)]">
                <Inbox className="h-6 w-6 text-[var(--color-gold-600)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                No data found
              </p>
            </div>
          ) : (
            rows.map((row, rowIndex) => (
              <div
                key={row._id || rowIndex}
                className={`p-4 space-y-2 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] shrink-0">
                      {col.label}
                    </span>
                    <span className="text-sm text-[var(--color-text)] text-right truncate">
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {pagination && (
        <Pagination
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          onLimitChange={pagination.onLimitChange}
        />
      )}
    </div>
  );
};

export default DataTable;