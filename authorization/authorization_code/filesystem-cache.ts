import { ICachingStrategy, ICachable } from './caching-types';
import * as fs from 'fs';
import { promisify } from 'util';

const cacheDirectory = './cache/';

export class FilesystemCache implements ICachingStrategy {

  async getOrCreate<T>(
    cacheKey: string,
    createFunction: () => Promise<T & ICachable & object>,
    updateFunction?: (item: T) => Promise<T & ICachable & object>
  ): Promise<T & ICachable> {
    if (updateFunction) {
      throw new Error('FilesystemCache does not support updateFunction');
    }

    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }


    const newCacheItem = await createFunction();
    if (!newCacheItem) {
      throw new Error("Could not create cache item");
    }

    // The caches implementations Spotify provided check if newCacheItem is an
    // "empty access token". Do I need to do that?
    //
    // See https://github.com/spotify/spotify-web-api-ts-sdk/blob/2635bbd9f060c27d5580648576a70e150efdc865/src/caching/GenericCache.ts#L36
    this.setCacheItem(cacheKey, newCacheItem);

    return newCacheItem;
  }

  async get<T>(cacheKey: string): Promise<T & ICachable | null> {
    const readFile = promisify(fs.readFile);
    try {
      const serialized: string = await readFile(this.getFilePath(cacheKey), 'utf8');
      return JSON.parse(serialized);
    } catch {
      return null;
    }
  }

  setCacheItem<T>(cacheKey: string, item: T & ICachable): void {
    const serialized = JSON.stringify(item);

    // I think we have to use the sync method here because setCacheItem()
    // doesn't return a Promise
    fs.writeFileSync(this.getFilePath(cacheKey), serialized, 'utf8');
  }

  remove(cacheKey: string): void {
    // I think we have to use the sync method here because remove()
    // doesn't return a Promise
    fs.unlinkSync(this.getFilePath(cacheKey));
  }

  private getFilePath(cacheKey: string): string {
    return cacheDirectory + cacheKey;
  }
}
