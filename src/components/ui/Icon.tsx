import type { CSSProperties } from "react";

const ICONS: Record<string, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  plus: "M12 5v14M5 12h14",
  filter: "M3 5h18M6 12h12M10 19h4",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
  upload: "M12 21V9m0 0 4 4m-4-4-4 4M4 3h16",
  copy: "M9 9h11v11H9zM5 5h11v3M5 5v11h3",
  calendar: "M3 7h18M5 4v3M19 4v3M3 7v13h18V7",
  mappin:
    "M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  plane: "M22 11 13 14 11 21l-2-7L2 12l20-9-9 8z",
  phone:
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.95.36 1.88.7 2.77a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.31-1.31a2 2 0 0 1 2.11-.45c.89.34 1.82.57 2.77.7a2 2 0 0 1 1.72 2z",
  excel:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h2l2 3 2-3h2 M8 17h8",
  pdf: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  x: "M18 6 6 18 M6 6l12 12",
  chevdown: "m6 9 6 6 6-6",
  chevright: "m9 6 6 6-6 6",
  chevleft: "m15 6-6 6 6 6",
  arrowright: "M5 12h14m-6-6 6 6-6 6",
  list: "M3 6h18M3 12h18M3 18h18",
  car: "M5 17h14 M3 11h18l-2-5H5z M7 17v2 M17 17v2 M7 14h.01 M17 14h.01",
  check: "m20 6-11 11-5-5",
  trash:
    "M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6",
  edit:
    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z",
  alert:
    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16v-4 M12 8h.01",
  history: "M3 12a9 9 0 1 0 3-6.71L3 8 M3 3v5h5",
  more: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  monitor: "M2 4h20v12H2z M8 20h8 M12 16v4",
};

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, stroke = 1.5, className, style }: IconProps) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  );
}
