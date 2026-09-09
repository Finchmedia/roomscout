import * as React from 'react';

/**
 * Pill-shaped message composer with optional send and orange voice buttons.
 * @startingPoint section="Forms" subtitle="Pill-Composer mit Senden und Voice-Einstieg" viewport="700x200"
 */
export interface ComposerProps {
  value: string;
  onChange?: (value: string) => void;
  /** Renders the send button when provided. */
  onSubmit?: (value: string) => void;
  /** Renders the orange mic button when provided. */
  onVoice?: () => void;
  placeholder?: string;
  label?: string;
  /** 60 default, 56–62 in context. */
  height?: number;
  showKeyboardIcon?: boolean;
  /** Thin divider after the icon (autopilot side note). */
  divider?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Composer(props: ComposerProps): JSX.Element;
