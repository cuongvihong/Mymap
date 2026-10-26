import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  function: <path d="M10.5 3.5H9a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 1 6 12.5H4.5M5.5 7.5h4.5" />,
  checklist: <path d="M3 4.5l1.2 1.2L6.2 3.5M3 9.5l1.2 1.2 2-2.2M8.5 5h4.5M8.5 10h4.5" />,
  database: (
    <>
      <ellipse cx="8" cy="4" rx="4.5" ry="1.8" />
      <path d="M3.5 4v8c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4M3.5 8c0 1 2 1.8 4.5 1.8S12.5 9 12.5 8" />
    </>
  ),
  world: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" />
    </>
  ),
  note: <path d="M4 2.5h6l2.5 2.5v8.5H4zM9.5 2.5V5.5h3M6 8.5h4M6 10.5h3" />,
  branch: <path d="M5 3v10M5 5.5c4 0 6 1 6 4.5M11 12.5v-1M11 9.5a1.2 1.2 0 1 0 0 .01" />,
  play: <path d="M5 3.5l7 4.5-7 4.5z" />,
  folder: (
    <path d="M2.5 4.5A1.2 1.2 0 0 1 3.7 3.3h2.6l1.4 1.5h4.6a1.2 1.2 0 0 1 1.2 1.2v5.5a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2z" />
  ),
  file: <path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 8.5h4M6 10.5h4" />,
  photo: (
    <>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
      <circle cx="6" cy="7" r="1" />
      <path d="M3 12l3.5-3 2.5 2 2-1.5 2.5 2" />
    </>
  ),
  arrow: <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" />,
  fork: (
    <path d="M5 3v4a2 2 0 0 0 2 2h2a2 2 0 0 1 2 2v2M5 3.2a.1.1 0 1 0 .01 0M11 13a.1.1 0 1 0 .01 0M5 13V9" />
  ),
  trash: <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8M7 7v3.5M9 7v3.5" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H4a1.5 1.5 0 0 0-1.5 1.5V9A1.5 1.5 0 0 0 4 10.5h1.5" />
    </>
  ),
  fold: <path d="M4 6l4 4 4-4M4 3h8" />,
  edit: <path d="M3 13l.7-3L10.5 3.2a1.4 1.4 0 0 1 2 2L5.7 12zM9.5 4.2l2 2" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  route: (
    <path d="M4 12.5a1.5 1.5 0 1 0 .01 0M12 3.5a1.5 1.5 0 1 0 .01 0M5.5 12.5h4a2 2 0 0 0 0-4h-3a2 2 0 0 1 0-4h4" />
  ),
  split: <path d="M3 5h10M3 11h10" />,
  merge: <path d="M3 8h10" />,
  align: <path d="M3 2.5v11M5.5 4.5h7M5.5 8h4.5M5.5 11.5h6" />,
  distribute: <path d="M2.5 3v10M13.5 3v10M6 5.5h4v5H6z" />,
  layout: <path d="M3 3.5h4v4H3zM9 3.5h4v4H9zM6 9.5h4v3H6z" />
}

export function RadialIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      {P[name] ?? P['plus']}
    </svg>
  )
}
