import * as FileSystem from 'expo-file-system/legacy';

const CACHE_DIR = FileSystem.documentDirectory + 'cover-images/';

// Stable filename derived from URL — collision-resistant enough for ~70 images.
function urlToFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (Math.imul(31, hash) + url.charCodeAt(i)) | 0;
  }
  const unsigned = (hash >>> 0).toString(16).padStart(8, '0');
  // Include the tail of the URL for human readability when debugging.
  const tail = url.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) ?? 'img';
  return `${unsigned}_${tail}`;
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * Returns a URI for the given remote URL.
 * - Cache hit: resolves instantly (~5ms disk check) with a local file:// URI.
 * - Cache miss: returns the remote URL immediately (no blocking download) and
 *   kicks off a background download so the next launch gets the cached file.
 * - Any failure: falls back to the original remote URL.
 */
export async function getCachedCoverImageUri(url: string): Promise<string> {
  try {
    const localPath = CACHE_DIR + urlToFilename(url);
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return info.uri;

    // Not cached yet — download in background for next launch, use remote now.
    ensureCacheDir()
      .then(() => FileSystem.downloadAsync(url, localPath))
      .catch(() => {});
    return url;
  } catch {
    return url;
  }
}

/**
 * Deletes cached files whose source URLs are no longer in the active set.
 * Call after divisions refresh to avoid unbounded disk growth.
 */
export async function pruneOldCoverImages(activeUrls: string[]): Promise<void> {
  try {
    const activeFilenames = new Set(activeUrls.map(urlToFilename));
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    await Promise.allSettled(
      files
        .filter((f) => !activeFilenames.has(f))
        .map((f) => FileSystem.deleteAsync(CACHE_DIR + f, { idempotent: true }))
    );
  } catch {
    // Non-critical — stale files just sit until next prune.
  }
}
