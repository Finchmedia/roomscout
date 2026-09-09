import * as React from 'react';

/**
 * Quiet bottom-centre note outside the conversation.
 */
export interface HintProps extends React.HTMLAttributes<HTMLDivElement> {

  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Hint(props: HintProps): JSX.Element;
