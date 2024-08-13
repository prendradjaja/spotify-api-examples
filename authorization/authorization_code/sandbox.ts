import * as fs from 'fs';
import { myFetch, myFetchRaw, stringifyArray, unsafeGet, dedupeById, myParse } from './my-util';
import { FilesystemCache } from './filesystem-cache';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import * as credentials from './credentials';

const access_token = fs.readFileSync('./access_token.txt', 'utf8');

async function main() {
  showCache();

  // demoMakeOneRequest();
  // makeHumanReadablePlaylists();
  // getAllPlaylists();

  // demoSDK();
  // demoCache();


  // getAllTracksInOnePlaylist('37i9dQZF1EFAW2Wx2Q7Fjt');
  // getAllTracksInEveryPlaylist();

  demoSearch();
}

function demoSearch() {
  let playlists = myParse(fs.readFileSync('./data/playlists.json', 'utf8')) as unknown[];
  playlists = dedupeById(playlists as any[]);

  let hydratedPlaylists: Record<string, any[]> = {};
  for (let playlist of playlists) {
    const id = unsafeGet<string>(playlist, 'id');
    hydratedPlaylists[id] = myParse(fs.readFileSync(getCachedPlaylistPath(id), 'utf8')) as any[];
  }

  const index = new PlaylistsByTrack();
  for (let playlistId in hydratedPlaylists) {
    const playlist = hydratedPlaylists[playlistId];
    for (let item of playlist) {
      const track = item.track;
      if (track.name) {
        const name = (track.name as string).toLowerCase();
        index.getItem(name).push(playlistId);
      }
    }
  }
  const matches = index.getItem('lmly');
  for (let id of matches) {
    console.log(`https://open.spotify.com/playlist/${id}`);
  }
}

// DefaultDict<string, string[]>
class PlaylistsByTrack {
  public dict: Partial<Record<string, string[]>> = {};

  public getItem(key: string) {
    if (!this.dict[key]) {
      this.dict[key] = [];
    }
    return this.dict[key];
  }
}

async function getAllTracksInEveryPlaylist() {
  let playlists = myParse(fs.readFileSync('./data/playlists.json', 'utf8')) as unknown[];
  playlists = dedupeById(playlists as any[]);

  const chunkSize = 5;
  const waitBetweenChunks = 1000; // in milliseconds
  for (let i = 0; i < playlists.length; i += chunkSize) {
    const chunk = playlists.slice(i, i + chunkSize);
    let j = 0;
    let allSkipped = true;
    for (let playlist of chunk) {
      const idx = i + j;
      const id = unsafeGet<string>(playlist, 'id');
      if (existsSync(getCachedPlaylistPath(id))) {
        // todo Should check if cached playlist is complete; if not, we still want to fetch
        console.log(idx, 'Skipped: Cache exists already');
      } else {
        allSkipped = false;
        console.log(idx, 'Fetching');
        getAllTracksInOnePlaylist(id).then(() =>
          console.log(idx, 'Done fetching')
        );
      }
      j++;
    }

    if (!allSkipped) {
      await sleeper(waitBetweenChunks);
    }
  }
}

function sleeper(delayInMilliseconds: number) {
  return new Promise<void>(resolve => setTimeout(() => resolve(), delayInMilliseconds));
}

function existsSync(path: string): boolean {
  try {
    fs.statSync(path);
    return true;
  } catch {
    return false;
  }
}

async function demoCache() {
  const cache = new FilesystemCache();
  let n: { value: number };
  n = await cache.getOrCreate(
    'n',
    () => Promise.resolve({ value: Math.random() })
  );
  console.log(n);
  n = await cache.getOrCreate(
    'n',
    () => Promise.resolve({ value: Math.random() })
  );
  console.log(n);
}

interface CacheStatus {
  fetched: number;
  total: number;
}

function showCache(): void {
  let playlists = myParse(fs.readFileSync('./data/playlists.json', 'utf8')) as unknown[];
  playlists = dedupeById(playlists as any[]);

  const statuses: CacheStatus[] = [];

  for (let playlist of playlists) {
    const unsafePlaylist = playlist as any;
    const id = unsafePlaylist.id as string;
    const total = unsafePlaylist.tracks.total as number;
    let cachedPlaylist: unknown[];
    try {
      cachedPlaylist = JSON.parse(fs.readFileSync(getCachedPlaylistPath(id), 'utf8'));
    } catch {
      cachedPlaylist = [];
    }
    const fetched = unsafeGet<number>(cachedPlaylist, 'length');
    statuses.push({
      total,
      fetched,
    });
  }

  const emptyStatuses = [];
  const unfetchedStatuses = [];
  const fullyFetchedStatuses = [];
  const otherStatuses = [];
  for (let status of statuses) {
    if (status.fetched === 0 && status.total === 0) {
      emptyStatuses.push(status);
    } else if (status.fetched === 0) {
      unfetchedStatuses.push(status);
    } else if (status.fetched === status.total) {
      fullyFetchedStatuses.push(status);
    } else {
      otherStatuses.push(status);
    }
  }

  console.log(`Number of playlists:                 ${statuses.length}`);
  console.log(`Of those:`);
  console.log(`- Number of empty playlists:         ${emptyStatuses.length}`);
  console.log(`- Number of unfetched playlists:     ${unfetchedStatuses.length}`);
  console.log(`- Number of fully fetched playlists: ${fullyFetchedStatuses.length}`);
  console.log(`- Number of other playlists:         ${otherStatuses.length}`);
}

function getCachedPlaylistPath(playlistId: string): string {
  return `./cache/playlist-${playlistId}.json`;
}

async function getAllTracksInOnePlaylist(playlistId: string) {
  // console.log('Getting all tracks from one playlist');

  const firstUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
  const filePath = getCachedPlaylistPath(playlistId);

  const options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
  };

  let url = firstUrl;
  let isFirst = true;
  let expectedTotal: number | undefined;
  const items = [];
  const maxRequests = 5;
  let i = 0;
  while (url && i < maxRequests) {
    i++;
    const response: any = await myFetch(url, options);
    url = response.next;

    if (isFirst) {
      expectedTotal = unsafeGet<number>(response, 'total');
    }

    items.push(...response.items);
    fs.writeFileSync(filePath, stringifyArray(items));
    // console.log(`Got ${items.length} of ${expectedTotal} items, saved in ${filePath}`);

    isFirst = false;
  }
}

// Makes ~10 API calls (with Pandu's library).
// Saves results in playlists.json.
async function getAllPlaylists() {
  console.log('Getting all playlists');
  const firstUrl = 'https://api.spotify.com/v1/me/playlists';
  const options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
  };

  let url = firstUrl;
  let isFirst = true;
  let expectedTotal: number | undefined;
  const items = [];
  const maxRequests = 20;
  let i = 0;
  while (url && i < maxRequests) {
    i++;
    const response: any = await myFetch(url, options);
    url = response.next;

    if (isFirst) {
      expectedTotal = unsafeGet<number>(response, 'total');
    }


    items.push(...response.items);
    fs.writeFileSync('./data/playlists.json', stringifyArray(items));
    console.log(`Got ${items.length} of ${expectedTotal} items, saved in data/playlists.json`);

    isFirst = false;
  }
}

function makeHumanReadablePlaylists() {
  console.log('Turning playlists.json into human readable form');
  let items = myParse(fs.readFileSync('./data/playlists.json', 'utf8')) as unknown[];
  items = dedupeById(items as any);
  let result = '';
  for (let item of items) {
    const unsafeItem = item as any;
    result += [
      `owner: ${unsafeItem.owner.display_name}`,
      `name: ${unsafeItem.name}`,
      `size: ${unsafeItem.tracks.total}`,
    ].join('\t') + '\n';
  }
  fs.writeFileSync('./data/human-readable-playlists.txt', result);
}

async function demoMakeOneRequest() {
  console.log('Making one API call:');
  // const url = 'https://api.spotify.com/v1/me/playlists';
  // const url = 'https://api.spotify.com/v1/users/pandubear/playlists';
  // const url = 'https://api.spotify.com/v1/playlists/0hToX38WDA7ATAr2WdhLXI/tracks';
  const url = 'https://api.spotify.com/v1/playlists/0hToX38WDA7ATAr2WdhLXI';
  console.log(url);
  const options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
  };

  const rawResponse = await myFetchRaw(url, options);
  console.log(rawResponse.headers.get('Content-Type'));
  const response = await rawResponse.json();
  fs.writeFileSync('./data/response.json', JSON.stringify(response));
  console.log('Response saved in data/response.json');
}

async function demoSDK() {
  // I think withAccessToken doesn't actually use the configured caching
  // strategy (maybe it uses no caching?), so I can't use it

  const api = SpotifyApi.withClientCredentials(
    credentials.client_id,
    credentials.client_secret,
    [],
    {
      // cachingStrategy: new FilesystemCache(),
    }
  );

  // const api = SpotifyApi.withAccessToken(
  //   credentials.client_id,
  //   {
  //     access_token,

  //     // todo I don't know if I need these values (if I do, are these the right values?)
  //     // In fact, removing them DOES work (just probably not guaranteed behavior)
  //     token_type: 'Basic',
  //     expires_in: 99999,
  //     refresh_token: '',
  //   },
  //   {
  //     // cachingStrategy: new FilesystemCache(),
  //   }
  // );

  let response = await api.playlists.getUsersPlaylists('pandubear', 5);
  response = await api.playlists.getUsersPlaylists('pandubear', 5);
  for (let item of response.items) {
    console.log(item.name);
  }

  // const items = await api.search("The Beatles", ["artist"]);
  //
  // console.table(items.artists.items.map((item) => ({
  //   name: item.name,
  //   followers: item.followers.total,
  //   popularity: item.popularity,
  // })));
}

main();
