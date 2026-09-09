import * as React from 'react';

/**
 * Event notification with action and dismiss.
 */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;
