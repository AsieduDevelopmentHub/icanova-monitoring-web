import type { ReactNode } from "react";

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
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty: string;
  caption?: string;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <div className="table-wrap">
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
    </div>
  );
}
