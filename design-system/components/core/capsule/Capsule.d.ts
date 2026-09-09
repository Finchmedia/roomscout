import * as React from 'react';

/**
 * Extracted-fact capsule that appears under the utterance and glides into the fact list.
 */
export interface CapsuleProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Capsule(props: CapsuleProps): JSX.Element;
