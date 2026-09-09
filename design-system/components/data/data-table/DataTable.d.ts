import * as React from 'react';

/**
 * Light operator table with muted header and hairline rows.
 */
export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns: { key: string; label: string; width?: string; muted?: boolean }[];
  rows: Record<string, React.ReactNode>[];
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function DataTable(props: DataTableProps): JSX.Element;
