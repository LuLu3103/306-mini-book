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
  var tocTabs = document.getElementById("tocTabs");
  var toggleAll = document.getElementById("toggleAll");
  var live = document.getElementById("liveRegion");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".lec-card"));

  var CHEVRON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  var EMPTY_HTML = tocBody.innerHTML;
  var state = { lecture: null, part: null };

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

  function partById(lec, partId) {
    for (var i = 0; i < lec.parts.length; i++) {
      if (lec.parts[i].id === partId) return lec.parts[i];
    }
    return lec.parts[0];
  }

  function renderPart(lec, part) {
    var html = "";
    part.chapters.forEach(function (ch, idx) {
      var num = idx + 1;
      var no = num < 10 ? "0" + num : String(num);
      var listId = "sec-" + lec.id + "-" + part.id + "-" + num;
      var hasSec = ch.sections && ch.sections.length > 0;
      var bodyHtml = hasSec ? ch.sections.map(sectionHtml).join("") : emptyChapterHtml(ch);

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
    return html;
  }

  function renderTabs(lec, activeId) {
    return lec.parts
      .map(function (part) {
        var active = part.id === activeId;
        return (
          '<button class="toc-tab" type="button" role="tab" id="tab-' + esc(part.id) + '"' +
          ' aria-selected="' + (active ? "true" : "false") + '" aria-controls="tocBody"' +
          ' tabindex="' + (active ? "0" : "-1") + '" data-part="' + esc(part.id) + '">' +
          '<span class="toc-tab-name">' + esc(part.name) + "</span>" +
          '<span class="toc-tab-count">' + part.chapters.length + " 章</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderActivePart(fade) {
    var lec = state.lecture ? DATA.lectures[state.lecture] : null;
    if (!lec) return;
    var part = partById(lec, state.part);
    state.part = part.id;
    tocBody.innerHTML = renderPart(lec, part);
    tocBody.setAttribute("role", "tabpanel");
    tocBody.setAttribute("aria-labelledby", "tab-" + part.id);
    syncToggleAll();
    if (fade !== false) playEnter();
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

  function selectLecture(id, partId) {
    var lec = DATA.lectures[id];
    if (!lec) return;

    state.lecture = id;
    var part = partById(lec, partId);
    state.part = part.id;

    cards.forEach(function (card) {
      var on = card.getAttribute("data-lecture") === id;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-expanded", on ? "true" : "false");
    });

    var t = totals(lec);
    tocHead.hidden = false;
    tocTabs.hidden = false;
    tocName.textContent = lec.name;
    tocMeta.textContent =
      t.parts + " 部分 · " + t.chapters + " 章 · " + t.sections + " 节 · 共 " + t.pages + " 页";
    tocTabs.innerHTML = renderTabs(lec, part.id);
    renderActivePart(true);

    live.textContent = "已展开" + lec.name + "目录，当前 " + part.name + "，共 " + part.chapters.length + " 章";

    var rect = tocPanel.getBoundingClientRect();
    var offscreen = rect.top > window.innerHeight * 0.58;
    if (offscreen) {
      tocPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function clearLecture() {
    state.lecture = null;
    state.part = null;
    cards.forEach(function (card) {
      card.classList.remove("is-selected");
      card.setAttribute("aria-expanded", "false");
    });
    tocHead.hidden = true;
    tocTabs.hidden = true;
    tocTabs.innerHTML = "";
    tocBody.removeAttribute("role");
    tocBody.removeAttribute("aria-labelledby");
    tocBody.innerHTML = EMPTY_HTML;
    live.textContent = "已收起目录";
  }

  function activatePart(partId) {
    var lec = state.lecture ? DATA.lectures[state.lecture] : null;
    if (!lec || !partId) return;
    var part = partById(lec, partId);
    state.part = part.id;
    Array.prototype.forEach.call(tocTabs.querySelectorAll(".toc-tab"), function (tab) {
      var active = tab.getAttribute("data-part") === part.id;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.setAttribute("tabindex", active ? "0" : "-1");
    });
    renderActivePart(true);
    live.textContent = "已切换到" + part.name + "目录，共 " + part.chapters.length + " 章";
  }

  if (tocTabs) {
    tocTabs.addEventListener("click", function (event) {
      var tab = event.target.closest ? event.target.closest(".toc-tab") : null;
      if (!tab) return;
      activatePart(tab.getAttribute("data-part"));
    });
    tocTabs.addEventListener("keydown", function (event) {
      var tabs = Array.prototype.slice.call(tocTabs.querySelectorAll(".toc-tab"));
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      var next = null;
      if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      tabs[next].focus();
      activatePart(tabs[next].getAttribute("data-part"));
    });
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
      selectLecture(initial, params.get("part") || undefined);
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

  /* ---------------- 顶栏搜索：章节 / 小节 ---------------- */
  var searchBox = document.getElementById("searchBox");
  var searchInput = document.getElementById("searchInput");
  var searchPanel = document.getElementById("searchPanel");
  var searchIndex = [];
  var searchActive = -1;
  var searchTimer = null;

  (function buildSearchIndex() {
    Object.keys(DATA.lectures).forEach(function (lectureId) {
      var lecture = DATA.lectures[lectureId];
      lecture.parts.forEach(function (part) {
        part.chapters.forEach(function (chapter) {
          searchIndex.push({
            lecture: lecture.name,
            part: part.name,
            kind: "章",
            title: chapter.title,
            chapter: chapter.title,
            href: chapter.file + "#page=" + chapter.page,
            srcPage: chapter.srcPage || chapter.page
          });
          (chapter.sections || []).forEach(function (sec) {
            searchIndex.push({
              lecture: lecture.name,
              part: part.name,
              kind: "节",
              title: sec.title,
              chapter: chapter.title,
              href: sec.file + "#page=" + sec.page,
              srcPage: sec.srcPage || sec.page
            });
          });
        });
      });
    });
  })();

  function searchNorm(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, "");
  }

  function searchRun(query) {
    var raw = String(query || "").trim();
    if (!raw) return [];
    var phrases = raw.split(/\s+/).filter(Boolean).map(searchNorm);
    var whole = searchNorm(raw);
    var hits = [];
    for (var i = 0; i < searchIndex.length; i++) {
      var item = searchIndex[i];
      var titleNorm = searchNorm(item.title);
      var hay = titleNorm + searchNorm(item.chapter) + searchNorm(item.part) + searchNorm(item.lecture);
      var ok = true;
      for (var p = 0; p < phrases.length; p++) {
        if (hay.indexOf(phrases[p]) === -1) { ok = false; break; }
      }
      if (!ok) continue;
      var score = 1;
      if (titleNorm.indexOf(whole) === 0) score = 4;
      else if (titleNorm.indexOf(whole) > -1) score = 3;
      else if (searchNorm(item.chapter).indexOf(whole) === 0) score = 2;
      hits.push({ item: item, score: score, order: i });
    }
    hits.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return hits.slice(0, 60).map(function (x) { return x.item; });
  }

  function highlightTitle(title, query) {
    var raw = String(query || "").trim().split(/\s+/)[0] || "";
    if (!raw) return esc(title);
    var idx = title.toLowerCase().indexOf(raw.toLowerCase());
    if (idx < 0) return esc(title);
    return esc(title.slice(0, idx)) + "<mark>" + esc(title.slice(idx, idx + raw.length)) + "</mark>" + esc(title.slice(idx + raw.length));
  }

  function renderSearch(query) {
    var value = String(query || "").trim();
    searchActive = -1;
    if (!value) { closeSearch(); return; }
    var results = searchRun(value);
    if (!results.length) {
      searchPanel.innerHTML = '<div class="sr-empty">没有找到「' + esc(value) + '」相关的章节</div>';
    } else {
      var html = '<div class="search-head">找到 ' + results.length + ' 条结果 · ↑↓ 选择，回车打开</div>';
      results.forEach(function (item, idx) {
        html +=
          '<button class="sr-item" type="button" role="option" aria-selected="false" id="sr-' + idx + '"' +
          ' data-href="' + esc(item.href) + '" title="' + esc(item.lecture + " · " + item.part + " · 第 " + item.srcPage + " 页") + '">' +
          '<span class="sr-main">' +
          '<span class="sr-title">' + highlightTitle(item.title, value) + "</span>" +
          '<span class="sr-meta">' + esc(item.lecture + " · " + item.part + " · " + item.kind + " · " + item.chapter) + "</span>" +
          "</span>" +
          '<span class="sr-page">P' + item.srcPage + "</span>" +
          "</button>";
      });
      searchPanel.innerHTML = html;
    }
    searchPanel.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function closeSearch() {
    if (!searchPanel) return;
    searchPanel.hidden = true;
    searchPanel.innerHTML = "";
    searchActive = -1;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function openSearchResult(href) {
    if (!href) return;
    window.open(href, "_blank", "noopener");
    closeSearch();
    searchInput.blur();
  }

  function moveSearchActive(step) {
    var items = searchPanel.querySelectorAll(".sr-item");
    if (!items.length) return;
    if (searchActive >= 0 && items[searchActive]) {
      items[searchActive].classList.remove("is-active");
      items[searchActive].setAttribute("aria-selected", "false");
    }
    searchActive = (searchActive + step + items.length) % items.length;
    var el = items[searchActive];
    el.classList.add("is-active");
    el.setAttribute("aria-selected", "true");
    searchInput.setAttribute("aria-activedescendant", el.id);
    el.scrollIntoView({ block: "nearest" });
  }

  if (searchBox && searchInput && searchPanel) {
    searchInput.addEventListener("input", function () {
      var value = searchInput.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { renderSearch(value); }, 110);
    });

    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (searchPanel.hidden && searchInput.value.trim()) renderSearch(searchInput.value);
        moveSearchActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSearchActive(-1);
      } else if (event.key === "Enter") {
        var items = searchPanel.querySelectorAll(".sr-item");
        var target = searchActive >= 0 ? items[searchActive] : items[0];
        if (target) {
          event.preventDefault();
          openSearchResult(target.getAttribute("data-href"));
        }
      } else if (event.key === "Escape") {
        closeSearch();
        searchInput.blur();
      }
    });

    searchInput.addEventListener("focus", function () {
      if (searchInput.value.trim()) renderSearch(searchInput.value);
    });

    searchPanel.addEventListener("click", function (event) {
      var item = event.target.closest ? event.target.closest(".sr-item") : null;
      if (item) openSearchResult(item.getAttribute("data-href"));
    });

    document.addEventListener("click", function (event) {
      if (!searchBox.contains(event.target)) closeSearch();
    });

    document.addEventListener("keydown", function (event) {
      var tag = document.activeElement ? document.activeElement.tagName : "";
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInput.focus();
      }
    });

    /* 深链接：?q=血压 直接展开搜索结果 */
    try {
      var preset = new URLSearchParams(location.search).get("q");
      if (preset) {
        searchInput.value = preset;
        renderSearch(preset);
      }
    } catch (err) {}
  }

})();
