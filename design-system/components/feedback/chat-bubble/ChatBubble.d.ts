import * as React from 'react';

/**
 * Conversation bubble: user right (rust), scout left (bare text).
 */
export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  who?: 'user' | 'scout';
  /** Small label above ("Du", "Dein Scout"). */
  label?: string;
  /** Transcript density. */
  compact?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ChatBubble(props: ChatBubbleProps): JSX.Element;
