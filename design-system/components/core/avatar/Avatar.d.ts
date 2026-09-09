import * as React from 'react';

/**
 * Initials circle used as the profile control ("HB").
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLElement> {
  initials?: string;
  size?: number;
  /** Render as a button. */
  interactive?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
