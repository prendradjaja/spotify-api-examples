import * as fs from 'fs';
import { myFetch, myFetchRaw, stringifyArray, unsafeGet, dedupeById } from './util';
import { FilesystemCache } from './filesystem-cache';

const access_token = fs.readFileSync('./access_token.txt', 'utf8');

async function main() {
  // demoCache();
  // demoMakeOneRequest();
  // makeHumanReadablePlaylists();
  // getAllPlaylists();
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
  let items = JSON.parse(fs.readFileSync('./data/playlists.json', 'utf8'));
  items = dedupeById(items);
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

main();
