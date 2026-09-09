import * as React from 'react';

/**
 * Dark pill summarising the brief, optionally expandable.
 */
export interface SummaryPillProps extends React.HTMLAttributes<HTMLElement> {
  icon?: React.ReactNode;
  chevron?: boolean;
  open?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function SummaryPill(props: SummaryPillProps): JSX.Element;
