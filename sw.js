/* 306-mini-book · Service Worker
   目的：PDF 分块只在第一次打开时下载，之后从浏览器缓存读取（跨会话有效）。

   策略（刻意保持简单，降低翻车面）：
   - 只接管同源 /pdf/chunks/ 下的 GET 请求，其它请求完全不干预
   - 命中缓存 → 直接返回缓存的完整 200 响应（忽略 Range，PDF 阅读器拿整份文件同样正常）
   - 未命中 → 拉取完整文件，写入 Cache Storage，再返回
   - 任何异常 → 落回网络请求，不影响正常浏览
   - 分块文件名带内容哈希，内容变化必然换名，因此可以放心永久缓存
   - 缓存上限 MAX_ENTRIES 块，超出后按写入顺序淘汰最早的
*/
const CACHE = "306-pdf-chunks-v1";
const MAX_ENTRIES = 100; /* 约 500 MB 上限 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.indexOf("306-pdf-chunks-") === 0 && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isChunk(url) {
  return url.origin === location.origin && url.pathname.indexOf("/pdf/chunks/") !== -1;
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const drop = keys.slice(0, keys.length - MAX_ENTRIES);
  await Promise.all(drop.map((req) => cache.delete(req)));
}

async function cacheFirst(url) {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return hit;

    const res = await fetch(url, { credentials: "same-origin" });
    if (res && res.ok && res.status === 200) {
      cache
        .put(url, res.clone())
        .then(() => trim(cache))
        .catch(() => {});
    }
    return res;
  } catch (err) {
    return fetch(url);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (!isChunk(url)) return;

  event.respondWith(cacheFirst(url.href));
});
