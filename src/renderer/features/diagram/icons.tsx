/** Small inline icons. They are decorative, the button that holds them carries the aria-label. */
interface IconProps {
  size?: number
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false
} as const

export function ChevronIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M5 6.5l3 3 3-3" />
    </svg>
  )
}

export function CopyIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5V9A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  )
}

export function PlayIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M5 3.2v9.6a.6.6 0 0 0 .92.5l7.4-4.8a.6.6 0 0 0 0-1l-7.4-4.8A.6.6 0 0 0 5 3.2z" />
    </svg>
  )
}

export function DocIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M9.5 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V5.5L9.5 2z" />
      <path d="M9.5 2v3.5H13M5.8 8.6h4.4M5.8 11h3" />
    </svg>
  )
}

export function CloseIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

export function MinusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3.5 8h9" />
    </svg>
  )
}

export function FitIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
    </svg>
  )
}

export function MapIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <rect x="8.5" y="7" width="4" height="4" rx="0.8" />
    </svg>
  )
}

export function CollapseAllIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M4 5.5l4 3.5 4-3.5M4 10.5l4 3 4-3" transform="translate(0 -1)" />
    </svg>
  )
}

export function TrashIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" />
    </svg>
  )
}

export function UndoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M5.5 3.5L3 6l2.5 2.5M3 6h6a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

export function RedoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M10.5 3.5L13 6l-2.5 2.5M13 6H7a3.5 3.5 0 0 0 0 7h3" />
    </svg>
  )
}

export function ImageIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="2" y="3" width="12" height="10" rx="1.6" />
      <circle cx="5.8" cy="6.6" r="1.1" />
      <path d="M2.6 12l3.6-3.4 2.6 2.4 2-1.8 2.6 2.4" />
    </svg>
  )
}

export function GripIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <circle cx="6" cy="4" r="1.1" />
      <circle cx="10" cy="4" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="6" cy="12" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
    </svg>
  )
}

export function PinIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M8 14s4.5-4 4.5-7.4A4.5 4.5 0 0 0 3.5 6.6C3.5 10 8 14 8 14z" />
      <circle cx="8" cy="6.6" r="1.6" />
    </svg>
  )
}

export function PencilIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3 13l.6-2.6L10.8 3.2a1.4 1.4 0 0 1 2 2L5.6 12.4 3 13zM9.6 4.4l2 2" />
    </svg>
  )
}

export function LayoutIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="2" y="2.5" width="4.5" height="4" rx="1" />
      <rect x="9.5" y="2.5" width="4.5" height="4" rx="1" />
      <rect x="5.5" y="9.5" width="5" height="4" rx="1" />
      <path d="M4.2 6.5v1.5h3.8M11.7 6.5v1.5H8V9.5" />
    </svg>
  )
}
