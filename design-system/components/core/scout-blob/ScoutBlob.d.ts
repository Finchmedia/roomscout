import * as React from 'react';

/**
 * The RoomScout assistant presence: an organic orange blob with restrained glow.
 * @startingPoint section="Core" subtitle="Der Scout — atmend, sprechend oder zuhörend" viewport="700x260"
 */
export interface ScoutBlobProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter in px. Welcome 168, working 160, brief 96, inline 58, tiny 44. */
  size?: number;
  /** idle = slow breathing; speaking = livelier; listening = calmer rotation; still = no animation. */
  state?: 'idle' | 'speaking' | 'listening' | 'still';
  /** Local orange glow (default true). */
  glow?: boolean;
}
export declare function ScoutBlob(props: ScoutBlobProps): JSX.Element;
