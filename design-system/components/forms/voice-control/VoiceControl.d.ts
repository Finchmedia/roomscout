import * as React from 'react';

/**
 * Large labelled circular control for the live conversation.
 */
export interface VoiceControlProps {
  tone?: 'neutral' | 'accent' | 'danger';
  size?: number;
  label: string;
  /** For accent tone: false renders the mic as off. */
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function VoiceControl(props: VoiceControlProps): JSX.Element;
