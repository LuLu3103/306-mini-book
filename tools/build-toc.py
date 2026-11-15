# -*- coding: utf-8 -*-
import re, json, os, logging
logging.disable(logging.WARNING)
from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))     # 306-mini-book/tools
SITE = os.path.dirname(HERE)                            # 306-mini-book
SRC = os.path.join(os.path.dirname(SITE), "原始资料")    # 工作区/原始资料
OUT = os.path.join(SITE, "assets", "data", "toc.json")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bad = re.compile(r"[^\u0020-\u007e\u3000-\u303f\u4e00-\u9fff\uff00-\uffef\n]")
def clean(s): return bad.sub("", s or "")
def op(rel): return PdfReader(os.path.join(SRC, rel))

def flatten(reader):
    res = []
    def walk(items, d):
        for it in items:
            if isinstance(it, list): walk(it, d + 1)
            else:
                try: p = reader.get_destination_page_number(it) + 1
                except Exception: p = -1
                res.append({"d": d, "t": (it.title or "").strip(), "p": p})
    try: walk(reader.outline, 0)
    except Exception: pass
    return res

def ptexts(reader):
    out = []
    for pg in reader.pages:
        try: out.append(clean(pg.extract_text() or ""))
        except Exception: out.append("")
    return out

def resolve(ents, texts):
    for i, e in enumerate(ents):
        if e["p"] >= 1: continue
        needle = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", e["t"])[:8]
        if not needle: continue
        start = 4
        for j in range(i - 1, -1, -1):
            if ents[j]["p"] >= 4:
                start = ents[j]["p"]; break
        for pi in range(start, len(texts)):
            if needle in re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", texts[pi]):
                e["p"] = pi + 1; break
    return ents

def outline_chapters(reader):
    ents = resolve(flatten(reader), ptexts(reader))
    chs, cur = [], None
    for e in ents:
        if e["t"] in ("目录", "封面") or not e["t"]: continue
        if e["d"] == 0:
            cur = {"title": e["t"], "page": e["p"], "sections": []}
            chs.append(cur)
        elif cur is not None and e["p"] >= 1:
            cur["sections"].append({"title": e["t"], "page": e["p"]})
    for c in chs:
        if c["page"] < 1 and c["sections"]: c["page"] = c["sections"][0]["page"]
    return chs

CH = re.compile(r"^第([一二三四五六七八九十]+)章\s*(.*?)\s*(\d+)?$")
phys = op(r"西综讲义PDF\physiology.pdf")
toc = [l.strip() for l in ptexts(phys)[1].split("\n") if l.strip()]
phys_chs, cur, pending = [], None, None
for ln in toc:
    m = CH.match(ln)
    if m:
        cur = {"title": re.sub(r"\s*\d+\s*$", "", ln).strip(), "page": int(m.group(3)) if m.group(3) else -1, "sections": []}
        phys_chs.append(cur); pending = None; continue
    if cur is None: continue
    m = re.match(r"^(\d+\.|串)", ln)
    if m:
        mm = re.search(r"(\d+)\s*$", ln)
        pg = int(mm.group(1)) if mm else None
        title = ln[: mm.start()].strip() if mm else ln
        pending = {"title": title, "page": pg if pg else -1}
        cur["sections"].append(pending); continue
    if pending is not None:
        if re.fullmatch(r"\d+", ln):
            pending["page"] = int(ln); pending = None
        else:
            pending["title"] = pending["title"] + clean(ln)
for c in phys_chs:
    if c["page"] < 1 and c["sections"]: c["page"] = c["sections"][0]["page"]
phys_chs = [{"title": c["title"], "page": c["page"], "sections": [s for s in c["sections"] if s["page"] >= 1]} for c in phys_chs]

XZ = [
    ("shengli", "生理学", "physiology.pdf", "xizong-physiology.pdf", 383),
    ("shenghua", "生物化学", "biochem.pdf", "xizong-biochem.pdf", 170),
    ("bingli", "病理学", "pathology.pdf", "xizong-pathology.pdf", 195),
    ("neike", "内科学", "internal.pdf", "xizong-internal.pdf", 397),
    ("waike", "外科学", "surgery1.pdf", "xizong-surgery1.pdf", 143),
]
parts_xz = []
for pid, name, src, fn, npg in XZ:
    if pid == "shengli":
        # 生理学目录取自 PDF 第 2 页的印刷目录（书页码），PDF 页码 = 书页码 + 2
        chs = [dict(c) for c in phys_chs]
        for c in chs:
            c["page"] += 2
            for s in c["sections"]:
                s["page"] += 2
    else:
        rr = op(os.path.join("西综讲义PDF", src))
        chs = outline_chapters(rr)
    for c in chs:
        c["file"] = "pdf/" + fn
        for s in c["sections"]: s["file"] = "pdf/" + fn
    parts_xz.append({"id": pid, "name": name, "file": "pdf/" + fn, "src": os.path.join("西综讲义PDF", src), "pages": npg, "chapters": chs})

# 合并 surgery2
r2 = op(r"西综讲义PDF\surgery2.pdf")
for c in outline_chapters(r2):
    for s in c["sections"]: s["file"] = "pdf/xizong-surgery2.pdf"
    base = re.sub(r"^[一二三四五六七八九十]+、", "", c["title"]).strip()
    tgt = None
    for c0 in parts_xz[4]["chapters"]:
        if re.sub(r"^[一二三四五六七八九十]+、", "", c0["title"]).strip() == base: tgt = c0; break
    if tgt: tgt["sections"].extend(c["sections"])
    else: parts_xz[4]["chapters"].append({"title": c["title"], "page": c["page"], "file": "pdf/xizong-surgery2.pdf", "sections": c["sections"]})
order = {"pdf/xizong-surgery1.pdf": 0, "pdf/xizong-surgery2.pdf": 1}
for p in parts_xz:
    for c in p["chapters"]:
        c["sections"].sort(key=lambda s: (order.get(s.get("file", ""), 0), s["page"]))

KB = [
    ("kb-neike", "内科（含诊断+部分外科）", "狂背【内科含诊断+部分外科】.pdf", "pdf/kb-neike.pdf", 73),
    ("kb-jichu", "基础学科横向大串联", "狂背【基础学科横向大串联】.pdf", "pdf/kb-jichu.pdf", 49),
    ("kb-waike", "外科+横向大串联", "狂背【外科+横向大串联 】.pdf", "pdf/kb-waike.pdf", 61),
]
SUBJ = ("生物化学", "病理学", "生理学")
KCH = re.compile(r"^([一二三四五六七八九十]+)、\s*(.+)$")
parts_kb = []
for pid, name, src, fn, npg in KB:
    rr = op(os.path.join("狂背讲义PDF", src))
    chs, cur = [], None
    for pi, t in enumerate(ptexts(rr)):
        lines = [x.strip() for x in t.split("\n") if x.strip()]
        lines = [x for x in lines if not x.startswith("每日计划") and not re.fullmatch(r"[-\s]*\d+[-\s]*", x)]
        for li, ln in enumerate(lines):
            if "天天师兄" not in ln:
                m = KCH.match(ln)
                if m and len(m.group(2)) >= 2:
                    cur = {"title": ln, "page": pi + 1, "sections": []}; chs.append(cur); continue
                if ln in SUBJ and li <= 2:
                    cur = {"title": ln, "page": pi + 1, "sections": []}; chs.append(cur); continue
            if "天天师兄" in ln and cur is not None:
                title = ln.split("天天师兄", 1)[1].strip(" ：:·、")
                if not title and li + 1 < len(lines): title = lines[li + 1].strip()
                if len(title) < 2 or "提示" in title: continue
                cand = {"title": title, "page": pi + 1}
                if cur["sections"] and cur["sections"][-1]["title"] == title and cur["sections"][-1]["page"] == pi + 1: continue
                cur["sections"].append(cand)
    # 外科册：拆分横向大串联
    if pid == "kb-waike":
        for i, c in enumerate(chs):
            if re.sub(r"^[一二三四五六七八九十]+、", "", c["title"]).strip() == "骨科疾病":
                hz = [s for s in c["sections"] if s["page"] >= 42]
                c["sections"] = [s for s in c["sections"] if s["page"] < 42]
                if hz: chs.append({"title": "横向大串联（英文·检查·分度分期）", "page": hz[0]["page"], "sections": hz})
                break
    for c in chs:
        c["file"] = fn
        for s in c["sections"]: s["file"] = fn
    parts_kb.append({"id": pid, "name": name, "file": fn, "src": os.path.join("狂背讲义PDF", src), "pages": npg, "chapters": chs})

RENAME = {
    "第一部分：物质代谢": "物质代谢",
    "第二部分": "分子生物学与基因表达",
    "第九章": "病理学总论",
}
def disp_title(t):
    t = t.strip()
    if t in RENAME: return RENAME[t]
    t = re.sub(r"^第[一二三四五六七八九十]+章\s*", "", t)
    t = re.sub(r"^[一二三四五六七八九十]+、\s*", "", t)
    return t.strip()
for lect in (parts_xz, parts_kb):
    for p in lect:
        for c in p["chapters"]:
            c["title"] = disp_title(c["title"])

data = {
  "generatedAt": "2026-11-15",
  "pdfBase": "pdf/",
  "lectures": {
    "xizong": {"id": "xizong", "name": "西综讲义", "parts": parts_xz},
    "kuangbei": {"id": "kuangbei", "name": "狂背讲义", "parts": parts_kb},
  }
}
with open(OUT, "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, indent=1)

# 校验
rep, errs = [], []
for lid, L in data["lectures"].items():
    tc = ts = 0; tpg = 0
    for p in L["parts"]:
        nc = len(p["chapters"]); ns = sum(len(c["sections"]) for c in p["chapters"])
        tc += nc; ts += ns; tpg += p["pages"]
        rep.append(f"{lid} / {p['name']}: {nc}章 {ns}节 pages={p['pages']}")
        lastp = 0
        for c in p["chapters"]:
            if not (1 <= c["page"] <= p["pages"]): errs.append(f"{p['name']} 章页码越界 {c['title']} p{c['page']}")
            if not c["sections"]: rep.append(f"   !! 无小节: {c['title']} p{c['page']}")
            for s in c["sections"]:
                if not (1 <= s["page"] <= p["pages"]): errs.append(f"{p['name']} 节页码越界 {s['title']} p{s['page']}")
    rep.append(f"== {lid} 合计 {len(L['parts'])}部分 {tc}章 {ts}节 {tpg}页")
# 同步生成页面实际读取的 toc.js（file:// 双击也能用）
with open(os.path.join(SITE, "assets", "data", "toc.js"), "w", encoding="utf-8") as f:
    f.write("/* 自动生成：不要手改，源文件 toc.json */\nwindow.TOC_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write(";\n")

print("\n".join(rep + ["", "ERRORS:"] + errs))
print("OK", os.path.getsize(OUT))
