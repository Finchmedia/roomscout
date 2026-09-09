import * as React from 'react';

/**
 * Uppercase letter-spaced section label.
 */
export interface OverlineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** muted grey-beige (default) or accent orange-light ("ANGEBOT EINGEGANGEN"). */
  tone?: 'muted' | 'accent';
  /** .18em tracking (landing section kickers). */
  wide?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Overline(props: OverlineProps): JSX.Element;
