import * as React from 'react';

/**
 * Rectangular settings input (46px, 12px radius).
 */
export interface TextInputProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** aria-label */
  label?: string;
  invalid?: boolean;
  /** Helper or error text under the field. */
  helper?: string;
  inputStyle?: React.CSSProperties;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function TextInput(props: TextInputProps): JSX.Element;
