export interface GenerateOptions {
  nodes?: number
  links?: number
  groups?: number
  scenarios?: number
  seed?: number
  layout?: boolean
}
export interface GeneratedProject {
  yaml: string
  nodes: { id: string; type: string; group?: string }[]
  links: { from: string; to: string; via: string }[]
  groups: { id: string; title: string; fs: string }[]
  scenarios: { id: string; type: string; parent?: string; at?: string; path: string[] }[]
}
export function generate(options?: GenerateOptions): GeneratedProject
export function fakePng(w: number, h: number, seed: number): Buffer
