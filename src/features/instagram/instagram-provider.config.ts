export const DEFAULT_INSTAGRAM_GRAPH_VERSION = "v26.0";

export function instagramGraphVersion(): string {
  const configured = process.env.INSTAGRAM_GRAPH_VERSION?.trim();
  if (!configured) return DEFAULT_INSTAGRAM_GRAPH_VERSION;
  return configured.startsWith("v") ? configured : `v${configured}`;
}

export function instagramGraphUrl(path: string): URL {
  const normalized = path.replace(/^\/+/, "");
  return new URL(
    `https://graph.instagram.com/${instagramGraphVersion()}/${normalized}`,
  );
}
