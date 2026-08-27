const digestCache = new Map<string, string>();

type TagModel = { name?: string; model?: string; digest?: string };

export async function resolveModelDigest(
  baseUrl: string,
  tag: string,
): Promise<string> {
  const key = `${baseUrl}|${tag}`;
  const cached = digestCache.get(key);
  if (cached) {
    return cached;
  }

  const tagsResponse = await fetch(`${baseUrl}/api/tags`);
  if (tagsResponse.ok) {
    const body = (await tagsResponse.json()) as { models?: TagModel[] };
    const match = (body.models ?? []).find(
      (model) =>
        model.name === tag ||
        model.model === tag ||
        model.name === `${tag}:latest`,
    );
    if (match?.digest) {
      digestCache.set(key, match.digest);
      return match.digest;
    }
  }

  const showResponse = await fetch(`${baseUrl}/api/show`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: tag }),
  });
  if (!showResponse.ok) {
    throw new Error(
      `Cannot resolve digest for model '${tag}' at ${baseUrl}: ${showResponse.status}`,
    );
  }
  const shown = (await showResponse.json()) as { digest?: string };
  if (!shown.digest) {
    throw new Error(`Ollama /api/show did not return a digest for '${tag}'`);
  }
  digestCache.set(key, shown.digest);
  return shown.digest;
}

export function clearDigestCache(): void {
  digestCache.clear();
}
