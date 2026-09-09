import * as React from 'react';

/**
 * Inline notice bar with dot and optional action.
 */
export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'warning' | 'success' | 'neutral' | 'accent';
  /** Inline action node (usually a link Button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Notice(props: NoticeProps): JSX.Element;
