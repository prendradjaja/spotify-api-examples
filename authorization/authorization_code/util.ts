export async function myFetch(url: string, options: RequestInit): Promise<unknown> {
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

export async function myFetchRaw(url: string, options: RequestInit): Promise<Response> {
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
  return response;
}

export function stringifyArray(arr: unknown[]): string {
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

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
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

export function unsafeGet<T>(obj: unknown, key: string): T {
  return (obj as any)[key];
}
