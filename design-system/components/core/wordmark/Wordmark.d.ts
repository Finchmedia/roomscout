import * as React from 'react';

/**
 * Plain lowercase "roomscout" wordmark. Never paired with a logo or cube icon inside the product UI.
 */
export interface WordmarkProps extends React.HTMLAttributes<HTMLElement> {
  /** Font size (20 header, 17 narrow/footer, 19 landing). */
  size?: number;
  color?: string;
  /** Render as a link. */
  href?: string;
  as?: 'div' | 'span' | 'h1';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Wordmark(props: WordmarkProps): JSX.Element;
