import * as React from 'react';

/**
 * Dark translucent card with a fine warm border.
 * @startingPoint section="Core" subtitle="Dunkle, leicht transluzente Karte mit feiner warmer Kontur" viewport="700x300"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Radius/padding scale: sm 16, md 20, lg 22, xl 24, 2xl 26, panel 28. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'panel';
  tone?: 'default' | 'soft' | 'faint' | 'accent' | 'warning' | 'inset' | 'panel' | 'rust';
  /** Landing bento hover: translateY(-3px). */
  hoverLift?: boolean;
  /** Override padding (CSS string or number). */
  padding?: string | number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
