import * as React from 'react';

/**
 * Circular icon-only button (header controls, send, voice entry).
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline' | 'subtle' | 'accent' | 'bare' | 'danger';
  /** Diameter (42 header, 44–46 composer, 36 inline, 30 toast). */
  size?: number;
  /** aria-label + title. */
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
