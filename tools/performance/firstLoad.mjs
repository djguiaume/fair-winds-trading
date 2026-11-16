/* global URL */
// What a phone downloads before the title menu is usable (issue #557): counted from the page's
// own responses, so a chunk pulled in by a new static import shows up as bytes and requests.

/** Starts counting responses on a page; `stop()` returns the totals. */
export function countFirstLoad(page) {
  const files = [];
  const pending = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    pending.push(
      response
        .body()
        .then((body) =>
          files.push({ file: url.pathname.split('/').pop() || 'index.html', bytes: body.length }),
        )
        .catch(() => {}),
    );
  });
  return async () => {
    await Promise.all(pending);
    return {
      requests: files.length,
      bytes: files.reduce((sum, f) => sum + f.bytes, 0),
      files: files.sort((a, b) => b.bytes - a.bytes),
    };
  };
}
