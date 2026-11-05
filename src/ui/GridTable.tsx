import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icons";

export type GridColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  width?: string;
  render: (row: T) => ReactNode;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function GridTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  caption,
  initialPageSize = 25,
  rowClassName,
  renderMobileRow,
}: {
  columns: GridColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty: string;
  caption?: string;
  initialPageSize?: (typeof PAGE_SIZES)[number];
  rowClassName?: (row: T) => string | undefined;
  renderMobileRow?: (row: T) => ReactNode;
}) {
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(initialPageSize);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const start = safePage * pageSize;
  const pageRows = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  const from = rows.length === 0 ? 0 : start + 1;
  const to = Math.min(start + pageSize, rows.length);
  const atStart = safePage <= 0;
  const atEnd = safePage >= pageCount - 1;

  return (
    <div className={`grid-table${renderMobileRow ? " has-mobile-rows" : ""}`}>
      <div className="grid-table-scroll">
        <table className="data-table dense grid-table-table">
          {caption ? <caption>{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.align === "right" ? "num" : undefined}
                  style={
                    column.width
                      ? { width: column.width, minWidth: column.width, maxWidth: column.width }
                      : undefined
                  }
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="empty" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={getRowKey(row)} className={rowClassName?.(row)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.align === "right" ? "num" : undefined}
                      style={
                        column.width
                          ? { width: column.width, maxWidth: column.width }
                          : undefined
                      }
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {renderMobileRow ? (
        <div className="grid-table-mobile" role="list" aria-label={caption ?? "Rows"}>
          {pageRows.length > 0 ? (
            pageRows.map((row) => (
              <div key={getRowKey(row)} role="listitem">
                {renderMobileRow(row)}
              </div>
            ))
          ) : (
            <p className="grid-table-mobile-empty">{empty}</p>
          )}
        </div>
      ) : null}
      <footer className="grid-table-pager">
        <div className="grid-table-meta">
          <label className="grid-table-size">
            <span className="meta grid-table-size-label">Rows</span>
            <select
              value={pageSize}
              aria-label="Rows per page"
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(0);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="meta grid-table-range">
            {from}–{to} of {rows.length}
          </span>
        </div>
        <div className="grid-table-nav" role="group" aria-label="Pagination">
          <button
            type="button"
            className="grid-table-page-btn"
            disabled={atStart}
            aria-label="First page"
            title="First page"
            onClick={() => setPage(0)}
          >
            <Icon name="chevronsLeft" size={16} />
          </button>
          <button
            type="button"
            className="grid-table-page-btn"
            disabled={atStart}
            aria-label="Previous page"
            title="Previous page"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="meta grid-table-page" aria-live="polite">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="grid-table-page-btn"
            disabled={atEnd}
            aria-label="Next page"
            title="Next page"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            <Icon name="chevronRight" size={16} />
          </button>
          <button
            type="button"
            className="grid-table-page-btn"
            disabled={atEnd}
            aria-label="Last page"
            title="Last page"
            onClick={() => setPage(pageCount - 1)}
          >
            <Icon name="chevronsRight" size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}
