import * as React from 'react';

/**
 * Stroke icon from the RoomScout set (24px viewBox, round caps, 1.6–2.2 stroke).
 */
export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Icon name, e.g. mic | keyboard | send | transcript | close | check | chevron-down | chevron-up | chevron-right | arrow-left | arrow-up-right | pin | users | clock | drum | search | list | edit | pause | play | restart | sliders | globe | doc | user | bell | card | shield | lock | building | home | mail | bars | database | tasks | plug | flag | pulse | music | plus | minus */
  name: string;
  /** Pixel size (default 18). */
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
