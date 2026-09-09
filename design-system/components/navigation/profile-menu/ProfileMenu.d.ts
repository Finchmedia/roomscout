import * as React from 'react';

/**
 * Dropdown under the avatar.
 */
export interface ProfileMenuProps {
  name?: string;
  subtitle?: string;
  items?: { label: string; icon?: React.ReactNode; onClick?: () => void }[];
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ProfileMenu(props: ProfileMenuProps): JSX.Element;
