import * as React from 'react';

/**
 * Large radio option as a card (Autopilot / Mit Rücksprache).
 */
export interface RadioCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onSelect?: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function RadioCard(props: RadioCardProps): JSX.Element;
