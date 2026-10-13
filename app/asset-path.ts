// Set at build time when hosting the standalone dashboard below an origin subpath.
export function assetPath(path: string) {
  return `${process.env.NEXT_PUBLIC_DASHBOARD_BASE_PATH || ''}${path}`
}
