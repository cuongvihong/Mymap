const pad = (n: number): string => String(n).padStart(2, '0')

/** BR-10: dd/mm/yyyy HH:mm, 24 hour clock, local time. Returns an empty string for invalid input. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
