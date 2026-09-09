import * as React from 'react';

/**
 * FAQ accordion item.
 */
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  question: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Accordion(props: AccordionProps): JSX.Element;
