/* 西综学习中心 · 交互脚本
   数据来源：assets/data/toc.js（window.TOC_DATA）
   目录结构：lectures.{id}.parts[].chapters[].sections[]，每条带 title / page / file */
(function () {
  "use strict";

  var DATA = window.TOC_DATA;
  var tocPanel = document.getElementById("tocPanel");
  var tocHead = document.getElementById("tocHead");
  var tocName = document.getElementById("tocName");
  var tocMeta = document.getElementById("tocMeta");
  var tocBody = document.getElementById("tocBody");
  var toggleAll = document.getElementById("toggleAll");
  var live = document.getElementById("liveRegion");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".lec-card"));

  var CHEVRON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  var EMPTY_HTML = tocBody.innerHTML;
  var state = { lecture: null };

  if (!DATA || !DATA.lectures) {
    tocBody.innerHTML =
      '<div class="toc-empty"><p class="toc-empty-title">目录数据未加载</p>' +
      '<p class="toc-empty-note">请确认 assets/data/toc.js 与页面在同一目录下</p></div>';
    return;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function totals(lec) {
    var out = { parts: lec.parts.length, chapters: 0, sections: 0, pages: 0 };
    lec.parts.forEach(function (part) {
      out.chapters += part.chapters.length;
      out.pages += part.pages || 0;
      part.chapters.forEach(function (ch) {
        out.sections += ch.sections ? ch.sections.length : 0;
      });
    });
    return out;
  }

  function pdfHref(file, page) {
    return esc(file) + "#page=" + page;
  }

  function sizeText(bytes) {
    if (!bytes) return "";
    var mb = bytes / 1048576;
    return (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + " MB";
  }

  function sectionHtml(sec) {
    var srcPage = sec.srcPage || sec.page;
    var size = sizeText(sec.bytes);
    var tip =
      "在新标签页打开讲义第 " + srcPage + " 页" +
      (size ? "（约 " + size + "，首次加载后自动缓存）" : "");
    return (
      '<a class="sec-item" href="' + pdfHref(sec.file, sec.page) + '" target="_blank"' +
      ' rel="noopener noreferrer" title="' + esc(tip) + '">' +
      '<span class="sec-name">' + esc(sec.title) + "</span>" +
      '<span class="sec-page">P' + srcPage + "</span>" +
      "</a>"
    );
  }

  function emptyChapterHtml(ch) {
    var srcPage = ch.srcPage || ch.page;
    var size = sizeText(ch.bytes);
    return (
      '<div class="sec-empty">本章未细分小节，' +
      '<a href="' + pdfHref(ch.file, ch.page) + '" target="_blank" rel="noopener noreferrer"' +
      (size ? ' title="' + esc("约 " + size + "，首次加载后自动缓存") + '"' : "") + ">" +
      "直接打开第 " + srcPage + " 页</a></div>"
    );
  }

  function render(lec) {
    var index = 0;
    var html = "";

    lec.parts.forEach(function (part) {
      if (!part.chapters.length) return;
      html +=
        '<div class="part-head">' +
        '<span class="part-dot" aria-hidden="true"></span>' +
        '<span class="part-name">' + esc(part.name) + "</span>" +
        '<span class="part-meta">' + part.chapters.length + " 章 · " + (part.pages || "-") + " 页</span>" +
        "</div>";

      part.chapters.forEach(function (ch) {
        index += 1;
        var no = index < 10 ? "0" + index : String(index);
        var listId = "sec-" + lec.id + "-" + index;
        var hasSec = ch.sections && ch.sections.length > 0;
        var bodyHtml = hasSec
          ? ch.sections.map(sectionHtml).join("")
          : emptyChapterHtml(ch);

        html +=
          '<div class="chapter">' +
          '<button class="ch-row" type="button" aria-expanded="false" aria-controls="' + listId + '">' +
          '<span class="ch-no" aria-hidden="true">' + no + "</span>" +
          '<span class="ch-title">' + esc(ch.title) + "</span>" +
          '<span class="ch-count">' + (hasSec ? ch.sections.length + " 节" : "—") + "</span>" +
          '<span class="ch-page">P' + (ch.srcPage || ch.page) + "</span>" +
          '<span class="ch-arrow" aria-hidden="true">' + CHEVRON + "</span>" +
          "</button>" +
          '<div class="sec-list" id="' + listId + '" aria-hidden="true"><div class="sec-inner">' +
          bodyHtml +
          "</div></div>" +
          "</div>";
      });
    });

    return html;
  }

  function onHeightDone(event) {
    var list = event.currentTarget;
    if (event.propertyName !== "height") return;
    list.removeEventListener("transitionend", onHeightDone);
    if (list.dataset.state === "open") list.style.height = "auto";
  }

  function openSectionList(list) {
    list.dataset.state = "open";
    list.style.height = list.scrollHeight + "px";
    list.addEventListener("transitionend", onHeightDone);
  }

  function closeSectionList(list) {
    list.dataset.state = "closed";
    list.style.height = list.scrollHeight + "px";
    void list.offsetHeight;
    list.style.height = "0px";
  }

  function setChapterOpen(row, open) {
    var wasOpen = row.getAttribute("aria-expanded") === "true";
    row.setAttribute("aria-expanded", open ? "true" : "false");
    var chapter = row.closest(".chapter");
    if (chapter) chapter.classList.toggle("is-open", open);
    var list = document.getElementById(row.getAttribute("aria-controls"));
    if (!list) return;
    list.setAttribute("aria-hidden", open ? "false" : "true");
    if (open === wasOpen) return;
    if (open) openSectionList(list);
    else closeSectionList(list);
  }

  function rows() {
    return Array.prototype.slice.call(tocBody.querySelectorAll(".ch-row"));
  }

  function syncToggleAll() {
    var list = rows();
    if (!list.length) {
      toggleAll.textContent = "全部展开";
      return;
    }
    var allOpen = list.every(function (row) {
      return row.getAttribute("aria-expanded") === "true";
    });
    toggleAll.textContent = allOpen ? "全部收起" : "全部展开";
    toggleAll.setAttribute("aria-expanded", allOpen ? "true" : "false");
  }

  function playEnter() {
    tocBody.classList.remove("is-enter");
    void tocBody.offsetWidth; /* 强制回流以重播动画 */
    tocBody.classList.add("is-enter");
  }

  function selectLecture(id) {
    var lec = DATA.lectures[id];
    if (!lec) return;

    state.lecture = id;
    cards.forEach(function (card) {
      var on = card.getAttribute("data-lecture") === id;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-expanded", on ? "true" : "false");
    });

    var t = totals(lec);
    tocHead.hidden = false;
    tocName.textContent = lec.name;
    tocMeta.textContent =
      t.parts + " 部分 · " + t.chapters + " 章 · " + t.sections + " 节 · 共 " + t.pages + " 页";
    tocBody.innerHTML = render(lec);
    syncToggleAll();
    playEnter();

    live.textContent =
      "已展开" + lec.name + "目录，共 " + t.chapters + " 章、" + t.sections + " 节";

    var rect = tocPanel.getBoundingClientRect();
    var offscreen = rect.top > window.innerHeight * 0.58;
    if (offscreen) {
      tocPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function clearLecture() {
    state.lecture = null;
    cards.forEach(function (card) {
      card.classList.remove("is-selected");
      card.setAttribute("aria-expanded", "false");
    });
    tocHead.hidden = true;
    tocBody.innerHTML = EMPTY_HTML;
    live.textContent = "已收起目录";
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      var id = card.getAttribute("data-lecture");
      if (state.lecture === id) clearLecture();
      else selectLecture(id);
    });
  });

  tocBody.addEventListener("click", function (event) {
    var row = event.target.closest ? event.target.closest(".ch-row") : null;
    if (!row) return;
    setChapterOpen(row, row.getAttribute("aria-expanded") !== "true");
    syncToggleAll();
  });

  function setAllOpen(open) {
    rows().forEach(function (row) {
      setChapterOpen(row, open);
    });
    syncToggleAll();
  }

  toggleAll.addEventListener("click", function () {
    var list = rows();
    if (!list.length) return;
    var allOpen = list.every(function (row) {
      return row.getAttribute("aria-expanded") === "true";
    });
    setAllOpen(!allOpen);
  });

  /* 深链接：index.html?lecture=xizong[&all=1] 可直接打开对应目录（便于分享） */
  try {
    var params = new URLSearchParams(window.location.search);
    var initial = params.get("lecture");
    if (initial && DATA.lectures[initial]) {
      selectLecture(initial);
      if (params.get("all") === "1") setAllOpen(true);
    }
  } catch (err) {
    /* 忽略参数解析异常 */
  }

  /* 悬停 / 聚焦时预取 PDF 分块：点击时已在缓存里，几乎瞬时打开 */
  var prefetched = {};
  function prefetchChunk(link) {
    if (!link) return;
    var href = (link.getAttribute("href") || "").split("#")[0];
    if (!href || prefetched[href]) return;
    prefetched[href] = true;
    try {
      fetch(href, { credentials: "same-origin" }).catch(function () {});
    } catch (err) {}
  }
  tocBody.addEventListener("pointerover", function (event) {
    var link = event.target.closest ? event.target.closest(".sec-item") : null;
    if (link) prefetchChunk(link);
  });
  tocBody.addEventListener("focusin", function (event) {
    var link = event.target.closest ? event.target.closest(".sec-item") : null;
    if (link) prefetchChunk(link);
  });

  /* 注册 Service Worker：已打开的 PDF 分块写入浏览器缓存，避免重复下载 */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* 使用说明弹层 */
  var helpBtn = document.getElementById("helpBtn");
  var helpDialog = document.getElementById("helpDialog");
  var helpClose = document.getElementById("helpClose");

  if (helpBtn && helpDialog && typeof helpDialog.showModal === "function") {
    helpBtn.addEventListener("click", function () {
      helpDialog.showModal();
    });
    if (helpClose) {
      helpClose.addEventListener("click", function () {
        helpDialog.close();
      });
    }
    helpDialog.addEventListener("click", function (event) {
      if (event.target === helpDialog) helpDialog.close();
    });
  } else if (helpBtn) {
    helpBtn.hidden = true;
  }

  /* 兜底：清除已缓存的 PDF 分块与 Service Worker */
  var clearCacheBtn = document.getElementById("clearCacheBtn");
  var clearCacheNote = document.getElementById("clearCacheNote");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", function () {
      if (clearCacheNote) clearCacheNote.textContent = "清理中…";
      Promise.resolve()
        .then(function () {
          return window.caches ? caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) { return caches.delete(key); }));
          }) : null;
        })
        .then(function () {
          return navigator.serviceWorker && navigator.serviceWorker.getRegistrations
            ? navigator.serviceWorker.getRegistrations().then(function (regs) {
                return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
              })
            : null;
        })
        .then(function () {
          if (clearCacheNote) clearCacheNote.textContent = "已清理，刷新页面后生效";
        })
        .catch(function () {
          if (clearCacheNote) clearCacheNote.textContent = "清理失败，可在浏览器设置中清除本站数据";
        });
    });
  }
})();
