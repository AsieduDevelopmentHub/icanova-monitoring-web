import type { ReactNode } from "react";
import { exportCellText, PageExport } from "./PageExport";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  caption,
  dense,
  rowClassName,
  renderMobileRow,
  exportTitle,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty: string;
  caption?: string;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
  renderMobileRow?: (row: T) => ReactNode;
  exportTitle?: string;
}) {
  return (
    <div className={`table-wrap${renderMobileRow ? " has-mobile-rows" : ""}`}>
      {exportTitle ? (
        <PageExport
          title={exportTitle}
          headers={columns.map((column) => column.header)}
          rows={rows.map((row) => columns.map((column) => exportCellText(column.render(row))))}
        />
      ) : null}
      <table className={`data-table${dense ? " dense" : ""}`}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === "right" ? "num" : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className={rowClassName?.(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === "right" ? "num" : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {renderMobileRow ? (
        <div className="data-table-mobile" role="list" aria-label={caption ?? "Rows"}>
          {rows.length > 0 ? (
            rows.map((row) => (
              <div key={getRowKey(row)} role="listitem">
                {renderMobileRow(row)}
              </div>
            ))
          ) : (
            <p className="data-table-mobile-empty">{empty}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
