import * as React from 'react';

/**
 * App header with wordmark and profile.
 * @startingPoint section="Navigation" subtitle="Wortmarke links, Status und Profil rechts" viewport="700x120"
 */
export interface AppHeaderProps {
  narrow?: boolean;
  initials?: string;
  /** Right-side content before the avatar (StatusDot, pause IconButton). */
  right?: React.ReactNode;
  onAvatar?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AppHeader(props: AppHeaderProps): JSX.Element;
