import * as React from 'react';

/**
 * Small tag: solid orange, uppercase accent outline, muted outline, or hero pill.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'outline' | 'muted' | 'pill';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
