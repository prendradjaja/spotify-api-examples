import * as fs from 'fs';

const access_token = fs.readFileSync('./access_token.txt', 'utf8');

async function main() {
  // processItems();
  // return;

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
    fs.writeFileSync('items.json', stringifyArray(items));
    console.log(`Got ${items.length} of ${expectedTotal} items`);

    isFirst = false;
  }
}

function processItems() {
  let items = JSON.parse(fs.readFileSync('./items.json', 'utf8'));
  console.log(items.length);
  items = dedupe(items);
  console.log(items.length);

  let result = '';
  for (let item of items) {
    const unsafeItem = item as any;
    result += [
      `owner: ${unsafeItem.owner.display_name}`,
      `name: ${unsafeItem.name}`,
      `size: ${unsafeItem.tracks.total}`,
    ].join('\t') + '\n';
  }
  fs.writeFileSync('human-readable-items.txt', result);
}

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const result = [];
  const seen = new Set();
  for (let item of items) {
    const id = item.id;
    if (seen.has(id)) {
      continue;
    } else {
      seen.add(id);
      result.push(item);
    }
  }
  return result;
}

function unsafeGet<T>(obj: unknown, key: string): T {
  return (obj as any)[key];
}

async function demoMakeOneRequest() {
  const url = 'https://api.spotify.com/v1/me/playlists';
  // const url = 'https://api.spotify.com/v1/users/pandubear/playlists';
  // const url = 'https://api.spotify.com/v1/playlists/0hToX38WDA7ATAr2WdhLXI/tracks';
  const options = {
    headers: { 'Authorization': 'Bearer ' + access_token },
  };

  const response: any = await myFetch(url, options);

  console.log(response.items.length);
  console.log(response.items.slice(0, 5).map((x: any) => x.name));
}

async function myFetch(url: string, options: RequestInit): Promise<unknown> {
  const response = await fetch(url, options);
  const statusCode = response.status; // todo any
  if (statusCode !== 200) {
    console.log('Request failed');
    console.log('- Status code: ' + statusCode);
    console.log('- statusText: ' + response.statusText);
    const json = await response.json();
    console.log('- error.message: ' + json.error.message);
    process.exit();
  }
  return response.json();
}

function stringifyArray(arr: unknown[]): string {
  if (arr.length === 0) {
    return '[]\n';
  }
  let result = '[';
  let isFirst = true;
  for (const [i, item] of arr.entries()) {
    const isLast = i === arr.length - 1;
    const prefix = isFirst ? '' : ' ';
    const suffix = isLast ? ']\n' : ',\n';
    result += prefix + JSON.stringify(item) + suffix;
  }
  return result;
}

main();
