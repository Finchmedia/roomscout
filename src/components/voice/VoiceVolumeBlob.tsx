import { useId } from "react";
import type { CSSProperties } from "react";
import styles from "./VoiceVolumeBlob.module.css";

type VoiceVolumeBlobProps = {
  volume: number;
  active?: boolean;
  label?: string;
};

type VolumeStyle = CSSProperties & { "--volume": number };

export function VoiceVolumeBlob({
  volume,
  active = true,
  label = "Voice activity",
}: VoiceVolumeBlobProps) {
  const normalizedVolume = Math.max(0, Math.min(1, volume));
  const style: VolumeStyle = { "--volume": normalizedVolume };
  const filterId = `roomscout-voice-warp-${useId().replace(/:/g, "")}`;

  return (
    <div
      aria-label={label}
      className={`${styles.stage} ${active ? "" : styles.paused}`}
      role="img"
      style={style}
    >
      <span aria-hidden="true" className={styles.halo} />
      <span aria-hidden="true" className={styles.haloSecondary} />
      <svg aria-hidden="true" className={styles.blob} viewBox="0 0 200 200">
        <defs>
          <filter height="150%" id={filterId} width="150%" x="-25%" y="-25%">
            <feTurbulence baseFrequency="0.011" numOctaves="2" result="noise" seed="8" type="fractalNoise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={9 + normalizedVolume * 24} xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </defs>
        <path
          className={styles.blobShape}
          d="M155.8 44.8c18.2 18.1 29.5 46.7 23.5 70.6-6.1 23.9-29.5 43.2-54.2 52.8-24.8 9.6-50.8 9.6-71.1-3.2-20.3-12.9-34.9-38.6-33.1-63.4 1.8-24.9 20-48.9 42.4-65.9 22.4-17 49.1-27 68.2-19.1 8.3 3.4 16.5 10.4 24.3 18.2Z"
          filter={`url(#${filterId})`}
        />
      </svg>
      <span aria-hidden="true" className={styles.core} />
    </div>
  );
}
