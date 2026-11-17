import type { GameEventId, RoleId } from '../../engine';

/** Hand-drawn 24px line icons. One visual language instead of emoji. */
const P: Record<string, string> = {
  // roles
  citizen: 'M3 11 12 4l9 7 M5 9.5V20h5v-6h4v6h5V9.5',
  detective: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M15.5 15.5 21 21 M8 8.5a3 3 0 0 1 3-1.5',
  doctor: 'M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z',
  bodyguard: 'M12 3 20 6v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z M12 8v8 M8.5 11.5h7',
  sheriff: 'M12 2.5 14.6 8l6 .7-4.4 4.1 1.2 6L12 15.8l-5.4 3 1.2-6L3.4 8.7l6-.7z M12 9.5v3',
  mafia: 'M3 21l5.5-5.5 M7 14.5 9.5 17 M8.3 15.7 19 5c1.6-1.6 2-2.5 2-2.5s-.9.4-2.5 2L8.3 15.7',
  godfather: 'M2.5 18.5h19 M5.5 18.5 7 9.5c3.2-1 6.8-1 10 0l1.5 9 M6.4 14h11.2',
  silencer: 'M4 9.5h3.5L13 5v14l-5.5-4.5H4z M16.5 9.5l5 5 M21.5 9.5l-5 5',
  jester: 'M3 7l4 9h10l4-9-5 3.5L12 4l-4 6.5z M7 19h10 M3 7v0 M21 7v0',
  survivor: 'M2.5 12.5h4.5l2.2-5 4 10 2.3-5h6',
  cupid: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z M2.5 21.5l6-6 M2.5 17.5v4h4',
  bomb: 'M10 8a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z M14.5 9.5 17 7 M18.5 3.5v2 M20.5 5.5h-2 M20 3.5l-1 1 M7 13a3 3 0 0 1 3-2',
  baker: 'M4 12a4 4 0 0 1 1.5-7.5h13A4 4 0 0 1 20 12v7.5H4z M9 8.5v4 M12.5 8.5v4 M16 8.5v4',
  // maps
  village: 'M2 21h20 M4 21V12l4-3 4 3v9 M12 21v-6l4-3 4 3v6 M7 21v-4h2v4 M8 6V3',
  hospital: 'M4 21V5h16v16 M2 21h20 M12 8v6 M9 11h6 M10 21v-3h4v3',
  villa: 'M2 21h20 M3 11 12 4l9 7 M5 9.5V21 M19 9.5V21 M8 21v-5h3v5 M14 13h3v3h-3z',
  photo: 'M3 7h4l2-3h6l2 3h4v13H3z M12 9.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z',
  id_card: 'M2.5 5h19v14h-19z M5.5 9h5v6h-5z M13.5 9.5h5 M13.5 12.5h5 M13.5 15.5h3',
  random: 'M4 4h16v16H4z M8.5 8.5v.1 M15.5 15.5v.1 M15.5 8.5v.1 M8.5 15.5v.1 M12 12v.1',
  globe2: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18',
  // events
  blood_moon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 9.5a1.5 1.5 0 1 0 0 .1 M14 14a2 2 0 1 0 0 .1 M15 7.5a1 1 0 1 0 0 .1',
  peaceful_night: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  fog: 'M3 8h13 M6 12h15 M3 16h11 M17 16h3',
  double_vote: 'M12 3v18 M6 21h12 M4 7h16 M7 7 4 13h6z M17 7l-3 6h6z',
  anonymous_vote: 'M3 3l18 18 M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.3 M6.3 7.6C4.1 9.2 3 12 3 12s4 6 9 6c1.6 0 3-.4 4.2-1',
  short_fuse: 'M6 3h12 M6 21h12 M7 3c0 5 10 5 10 9s-10 4-10 9 M17 3c0 5-10 5-10 9s10 4 10 9',
  // ui
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2.5 M12 19.5V22 M2 12h2.5 M19.5 12H22 M4.9 4.9l1.8 1.8 M17.3 17.3l1.8 1.8 M4.9 19.1l1.8-1.8 M17.3 6.7l1.8-1.8',
  skull: 'M12 3c-4.4 0-8 3.2-8 7.5 0 2.4 1.1 4.1 3 5.2V19h2v-2h2v2h2v-2h2v2h2v-3.3c1.9-1.1 3-2.8 3-5.2C20 6.2 16.4 3 12 3z M9 10.5a1.5 1.5 0 1 0 0 .1 M15 10.5a1.5 1.5 0 1 0 0 .1',
  crown: 'M3 7l4.5 4L12 5l4.5 6L21 7l-2 11H5z',
  mute: 'M7 9h4l5-4v14l-5-4H7z M3 3l18 18',
  vote: 'M4 13h16v8H4z M8 13V4h8v9 M10.5 8l1.5 1.5L15 6.5',
  check: 'M4 12.5 9.5 18 20 6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  menu: 'M4 7h16 M4 12h16 M4 17h10',
  back: 'M15 5l-7 7 7 7',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  device: 'M7 2.5h10v19H7z M10.5 18.5h3',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M21 20H3',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9 7 7 M17 17l2.1 2.1 M4.9 19.1 7 17 M17 7l2.1-2.1',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  key: 'M8 10a4 4 0 1 0 0 .1 M11.5 11.5 21 11.5 M17 11.5v3.5 M20 11.5v2.5',
  plus: 'M12 5v14 M5 12h14',
  x: 'M6 6l12 12 M18 6 6 18',
  target: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  flag: 'M5 21V4 M5 4h12l-2.5 4L17 12H5',
  skip: 'M5 5l8 7-8 7z M17 5v14',
  sound: 'M4 9.5h3.5L13 5v14l-5.5-4.5H4z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12',
  music: 'M9 18V5l11-2v13 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M20 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  door: 'M5 21V3h11v18 M16 21h3 M5 21H3 M13 12v.1',
  house: 'M3 11 12 4l9 7 M5 9.5V20h14V9.5',
  new: 'M12 3v18 M3 12h18',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  copy: 'M8 8h12v12H8z M16 8V4H4v12h4'
};

export type IconName = keyof typeof P | RoleId | GameEventId;

export function Icon({ name, size = 18, className = '', strokeWidth = 1.7, title }: { name: IconName | string; size?: number; className?: string; strokeWidth?: number; title?: string }) {
  const d = P[name] ?? P.target;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter" className={`inline-block shrink-0 ${className}`} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

export const RoleIcon = ({ role, size, className }: { role: RoleId; size?: number; className?: string }) => <Icon name={role} size={size} className={className} />;
