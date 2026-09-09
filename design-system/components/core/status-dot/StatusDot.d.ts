import * as React from 'react';

/**
 * Colored dot with status text.
 */
export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'accent' | 'success' | 'warning' | 'muted' | 'neutral' | string;
  /** Slow opacity blink while the Scout is working. */
  pulse?: boolean;
  size?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function StatusDot(props: StatusDotProps): JSX.Element;
