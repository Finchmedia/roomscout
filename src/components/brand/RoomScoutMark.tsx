type RoomScoutMarkProps = {
  size?: number;
  title?: string;
};

export function RoomScoutMark({ size = 24, title }: RoomScoutMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className="rs-mark"
      height={size}
      role={title ? "img" : undefined}
      viewBox="0 0 26 26"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      <rect className="rs-mark__outline" fill="none" height="22" stroke="currentColor" strokeWidth="2" width="22" x="2" y="2" />
      <rect className="rs-mark__cutout" height="10" width="2" x="24" y="8" />
      <line className="rs-mark__signal" strokeWidth="2" x1="17" x2="17" y1="2" y2="24" />
    </svg>
  );
}
