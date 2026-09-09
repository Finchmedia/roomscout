import * as React from 'react';

/**
 * Sidebar item for settings and operator views.
 */
export interface NavItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  current?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function NavItem(props: NavItemProps): JSX.Element;
