import * as fs from 'fs';
import { myFetch, myFetchRaw, stringifyArray, unsafeGet, dedupeById, myParse } from './my-util';
import { FilesystemCache } from './filesystem-cache';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { SimplifiedPlaylistObject, SimplifiedArtistObject, TrackObject, PlaylistTrackObject, CurrentUserPlaylistsResponse, PlaylistItemsResponse, ErrorResponse } from './spotify-api-types';
import * as credentials from './credentials';
import { z } from 'zod';

const access_token = fs.readFileSync('./access_token.txt', 'utf8');

async function main() {
  showCache();

  // demoHitRateLimit();
  // demoMakeOneRequest();
  // makeHumanReadablePlaylists();
  // getAllPlaylists();

  // demoSDK();

  // getAllTracksInOnePlaylist('37i9dQZF1EFAW2Wx2Q7Fjt');
  // getAllTracksInEveryPlaylist();

  // demoSearch();

  // enrichPlaylistsWithCreationOrder();
}

function enrichPlaylistsWithCreationOrder() {
  let playlistsFromAPI: any[] = JSON.parse(fs.readFileSync('./data/playlists.json', 'utf8'));
  playlistsFromAPI = dedupeById(playlistsFromAPI);

  let playlistsByCreationOrder: string[][] =
    JSON.parse(
      fs.readFileSync('./data/playlist-creation-order.json', 'utf8')
    );

  const unmatched = [];
  for (let unsafePlaylist of playlistsFromAPI) {
    const name: string = unsafePlaylist.name;
    const id: string = unsafePlaylist.id;
    const owner: string = unsafePlaylist.owner.display_name;
    const playlist = { id, name, owner };

    const match = playlistsByCreationOrder.find(other => other[0] === name && other[1] === owner);
    if (!match) {
      unmatched.push(playlist);
    } else {
      match.push(id);
    }
  }

  for (let each of playlistsByCreationOrder) {
    console.log(JSON.stringify(each));
  }
  console.log('---');
  for (let each of unmatched) {
    console.log(JSON.stringify(each));
  }
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
  let playlists =
    z.array(SimplifiedPlaylistObject)
    .parse(
      JSON.parse(fs.readFileSync('./data/playlists.json', 'utf8'))
    );
  playlists = dedupeById(playlists);

  const chunkSize = 5;
  const waitBetweenChunks = 1000; // in milliseconds
  for (let i = 0; i < playlists.length; i += chunkSize) {
    const chunk = playlists.slice(i, i + chunkSize);
    let j = 0;
    let allSkipped = true;
    for (let playlist of chunk) {
      const idx = i + j;
      if (existsSync(getCachedPlaylistPath(playlist.id))) {
        // todo Should check if cached playlist is complete; if not, we still want to fetch
        console.log(idx, 'Skipped: Cache exists already');
      } else {
        allSkipped = false;
        console.log(idx, 'Fetching');
        getAllTracksInOnePlaylist(playlist.id).then(() =>
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
  const firstUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
  const filePath = getCachedPlaylistPath(playlistId);

  const options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
  };

  let url: string | null = firstUrl;
  let isFirst = true;
  let expectedTotal: number | undefined;
  const items = [];
  const maxRequests = 5;
  let i = 0;
  while (url && i < maxRequests) {
    i++;
    // console.log(url);
    const rawResponse = await myFetch(url, options);
    // fs.writeFileSync('raw-response.json', JSON.stringify(rawResponse));
    // console.log('Wrote to raw-response.json');
    const response = PlaylistItemsResponse.parse(rawResponse);
    url = response.next;

    if (isFirst) {
      expectedTotal = response.total;
    }

    items.push(...response.items);
    fs.writeFileSync(filePath, stringifyArray(items));

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

  let url: string | null = firstUrl;
  let isFirst = true;
  let expectedTotal: number | undefined;
  const items: SimplifiedPlaylistObject[] = [];
  const maxRequests = 20;
  let i = 0;
  while (url && i < maxRequests) {
    i++;
    const response = CurrentUserPlaylistsResponse.parse(await myFetch(url, options));
    url = response.next;

    if (isFirst) {
      expectedTotal = response.total;
    }

    items.push(...response.items);
    fs.writeFileSync('./data/playlists.json', stringifyArray(items));
    console.log(`Got ${items.length} of ${expectedTotal} items, saved in data/playlists.json`);

    isFirst = false;
  }
}

function makeHumanReadablePlaylists() {
  console.log('Turning playlists.json into human readable form');
  let items =
    z.array(SimplifiedPlaylistObject)
    .parse(
      JSON.parse(
        fs.readFileSync('./data/playlists.json', 'utf8')
      )
    ) ;
  items = dedupeById(items);
  let result = '';
  for (let item of items) {
    result += [
      `owner: ${item.owner.display_name}`,
      `name: ${item.name}`,
      `size: ${item.tracks.total}`,
    ].join('\t') + '\n';
  }
  fs.writeFileSync('./data/human-readable-playlists.txt', result);
}

// async function demoMakeOneRequest() {
//   console.log('Making one API call:');
//   // const url = 'https://api.spotify.com/v1/me/playlists';
//   // const url = 'https://api.spotify.com/v1/users/pandubear/playlists';
//   // const url = 'https://api.spotify.com/v1/playlists/0hToX38WDA7ATAr2WdhLXI/tracks';
//   const url = 'https://api.spotify.com/v1/playlists/0hToX38WDA7ATAr2WdhLXI';
//   console.log(url);
//   const options = {
//     headers: { 'Authorization': 'Bearer ' + access_token },
//   };
//
//   const rawResponse = await myFetchRaw(url, options);
//   console.log(rawResponse.headers.get('Content-Type'));
//   const response = await rawResponse.json();
//   fs.writeFileSync('./data/response.json', JSON.stringify(response));
//   console.log('Response saved in data/response.json');
// }

async function demoHitRateLimit() {
  console.log('Making one API call repeatedly to hit the rate limit:');
  const url = 'https://api.spotify.com/v1/me';
  const options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
  };

  const promises = Array.from({ length: 200 }, () => myFetchRaw(url, options));
}

// async function demoSDK() {
//   // I think withAccessToken doesn't actually use the configured caching
//   // strategy (maybe it uses no caching?), so I can't use it
//
//   const api = SpotifyApi.withClientCredentials(
//     credentials.client_id,
//     credentials.client_secret,
//     [],
//     {
//       // cachingStrategy: new FilesystemCache(),
//     }
//   );
//
//   // const api = SpotifyApi.withAccessToken(
//   //   credentials.client_id,
//   //   {
//   //     access_token,
//
//   //     // todo I don't know if I need these values (if I do, are these the right values?)
//   //     // In fact, removing them DOES work (just probably not guaranteed behavior)
//   //     token_type: 'Basic',
//   //     expires_in: 99999,
//   //     refresh_token: '',
//   //   },
//   //   {
//   //     // cachingStrategy: new FilesystemCache(),
//   //   }
//   // );
//
//   let response = await api.playlists.getUsersPlaylists('pandubear', 5);
//   response = await api.playlists.getUsersPlaylists('pandubear', 5);
//   for (let item of response.items) {
//     console.log(item.name);
//   }
//
//   // const items = await api.search("The Beatles", ["artist"]);
//   //
//   // console.table(items.artists.items.map((item) => ({
//   //   name: item.name,
//   //   followers: item.followers.total,
//   //   popularity: item.popularity,
//   // })));
// }

main();
