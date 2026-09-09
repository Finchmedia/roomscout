import * as React from 'react';

/**
 * 56×32 toggle, orange when on.
 * @startingPoint section="Forms" subtitle="Toggle für Quellen und Handlungsspielraum" viewport="700x200"
 */
export interface SwitchProps extends React.HTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** aria-label */
  label?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Switch(props: SwitchProps): JSX.Element;
