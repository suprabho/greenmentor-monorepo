import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface AdminTableColumn<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  /** Secondary columns collapse on narrow screens. */
  responsive?: "primary" | "secondary";
  className?: string;
  headerClassName?: string;
  /** Keep actions visible while dense rows scroll horizontally. */
  sticky?: boolean;
}

export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  caption,
  getRowClassName,
  minWidth = "default",
}: {
  rows: T[];
  columns: AdminTableColumn<T>[];
  rowKey: (row: T) => string;
  empty: ReactNode;
  caption?: string;
  getRowClassName?: (row: T) => string;
  minWidth?: "default" | "none";
}) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-[14px] border border-gray-200 bg-white shadow-soft">
      <table className={clsx("w-full border-collapse text-[13px]", minWidth === "default" && "min-w-[720px]")}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cellClasses(column, true)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={clsx("group transition-colors hover:bg-gray-50", getRowClassName?.(row))}
            >
              {columns.map((column) => (
                <td key={column.key} className={cellClasses(column, false)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <div className="px-5 py-12 text-center text-[13px] text-gray-500">{empty}</div> : null}
    </div>
  );
}

function cellClasses<T>(column: AdminTableColumn<T>, header: boolean): string {
  return clsx(
    header ? "px-4 py-3 font-semibold" : "px-4 py-3.5 align-middle",
    column.responsive === "secondary" && "hidden md:table-cell",
    column.sticky && "sticky right-0 bg-white group-hover:bg-gray-50",
    column.className,
    header && column.headerClassName,
  );
}
