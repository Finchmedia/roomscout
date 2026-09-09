import * as React from 'react';

/**
 * Pill button. Primary orange, secondary outlined, tint (orange-tinted answer), ghost, link, danger.
 * @startingPoint section="Core" subtitle="Pill-Buttons: primär, sekundär, Tint, Ghost, Link" viewport="700x300"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tint' | 'ghost' | 'link' | 'danger';
  /** lg 60px (welcome CTA), md 56px (card CTA), base 50px, sm 46px, xs 44px, 2xs 36px. */
  size?: 'lg' | 'md' | 'base' | 'sm' | 'xs' | '2xs';
  /** Leading icon node. */
  icon?: React.ReactNode;
  /** Full width. */
  block?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
