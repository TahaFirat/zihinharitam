/**
 * 180-Entry LRU Visual & ObjectURL Memory Cache (Module 3)
 * Automatically revokes evicted `blob:` URLs via `URL.revokeObjectURL` so long study sessions
 * on iOS/iPadOS never accumulate orphaned GPU/Blob memory.
 */
export class StickerMemoryCache {
  private readonly maxEntries: number;
  private readonly map = new Map<string, string>();

  constructor(maxEntries = 180) {
    this.maxEntries = maxEntries;
  }

  public get(key: string): string | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;
    // Refresh recency
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  public set(key: string, url: string): void {
    const prev = this.map.get(key);
    if (prev !== undefined) {
      if (prev !== url && prev.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          // Ignore revoke errors
        }
      }
      this.map.delete(key);
    }

    this.map.set(key, url);

    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldestUrl = this.map.get(oldestKey);
      this.map.delete(oldestKey);
      if (oldestUrl && oldestUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(oldestUrl);
        } catch {
          // Ignore revoke errors
        }
      }
    }
  }

  public clearAll(): void {
    for (const url of this.map.values()) {
      if (url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore
        }
      }
    }
    this.map.clear();
  }

  public get size(): number {
    return this.map.size;
  }
}

export const globalStickerMemoryCache = new StickerMemoryCache(180);
