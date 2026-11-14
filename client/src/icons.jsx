import React from 'react';

const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  dumbbell: <><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></>,
  apple: <><path d="M12 8c-3.5-2.5-7 .5-7 4.5C5 17 8 21 12 21s7-4 7-8.5C19 8.5 15.5 5.5 12 8Z" /><path d="M12 8c0-2 .8-3.5 3-4.5" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.7c2.2.6 3.5 2.2 3.5 5.3" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5L20 7" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>,
  'eye-off': <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M2.5 18.5 18.5 2.5" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  flame: <path d="M12 22c4.4 0 7-2.9 7-6.5 0-4.5-4-6.5-4.5-11-2 2-3 4-3 6 0 1.2-.6 2-1.5 2S8.5 11.6 8.5 10C7 11.8 5 13.4 5 15.5 5 19.1 7.6 22 12 22Z" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></>,
  medal: <><circle cx="12" cy="14" r="5" /><path d="M8.5 9.5 6 3h4l2 4 2-4h4l-2.5 6.5" /></>,
  ruler: <><path d="m4 15 5 5 11-11-5-5Z" /><path d="m8 11 2 2M11 8l2 2M5 14l2 2" /></>,
  sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /><circle cx="12" cy="12" r="2.5" /></>,
  heart: <path d="M12 21s-7-4.4-9-8.5C1.5 9 3 5.5 6.5 5.5c2 0 3.4 1 4.5 2.6 1.1-1.6 2.5-2.6 4.5-2.6C19 5.5 22.5 9 20.5 12.5 19 16.6 12 21 12 21Z" />,
  message: <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 21l1.5-5.3a8.5 8.5 0 1 1 16.5-3.7Z" />,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  camera: <><path d="M4 7h3l2-3h6l2 3h3v13H4Z" /><circle cx="12" cy="13" r="4" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  more: <><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>,
  arrowUp: <path d="M12 20V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 4v15M6 13l6 6 6-6" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  droplet: <path d="M12 3c3.5 4.5 6 7.6 6 10.5A6 6 0 0 1 6 13.5C6 10.6 8.5 7.5 12 3Z" />,
  utensils: <><path d="M5 3v8a3 3 0 0 0 6 0V3M8 11v10" /><path d="M17 3c2 2 2 5 0 7v11" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
  minus: <path d="M5 12h14" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  sunrise: <><path d="M3 18h18M6 14a6 6 0 0 1 12 0M12 3v3M4.5 7.5 6 9M19.5 7.5 18 9" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  lockOpen: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7-2.5" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7" /></>,
  scale: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9a4 4 0 0 1 8 0M12 9v4" /></>,
  activity: <path d="M2 12h4l3-8 4 16 3-8h6" />,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v5h5" /><path d="M12 8v5l3 2" /></>,
};

export function Icon({ name = 'circle', size = 20, strokeWidth = 1.8, className = '', ...rest }) {
  const content = ICONS[name] || ICONS.info;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
}

export function Logo({ size = 34, withText = true }) {
  return (
    <span className="logo" aria-label="FitPulse">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="logo-mark">
        <defs>
          <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c9f75a" />
            <stop offset="1" stopColor="#4fe3c1" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="var(--logo-bg, #101512)" />
        <path
          d="M12 34h9l4-12 7 24 5-18 3 6h12"
          fill="none"
          stroke="url(#brandGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withText && (
        <span className="logo-text">
          Fit<span>Pulse</span>
        </span>
      )}
    </span>
  );
}
