import * as React from 'react';

/**
 * −/+ integer stepper.
 */
export interface StepperProps {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Stepper(props: StepperProps): JSX.Element;
