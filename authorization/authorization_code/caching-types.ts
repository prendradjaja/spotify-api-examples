// todo delete this file and install spotify-web-api-ts-sdk as a dependency; import these types from there instead

// Copied from https://github.com/spotify/spotify-web-api-ts-sdk/blob/main/src/types.ts
export interface ICachingStrategy {
    getOrCreate<T>(
        cacheKey: string,
        createFunction: () => Promise<T & ICachable & object>,
        updateFunction?: (item: T) => Promise<T & ICachable & object>
    ): Promise<T & ICachable>;

    get<T>(cacheKey: string): Promise<T & ICachable | null>;
    setCacheItem<T>(cacheKey: string, item: T & ICachable): void;
    remove(cacheKey: string): void;
}

export interface ICachable {
    expires?: number;
    expiresOnAccess?: boolean;
}
