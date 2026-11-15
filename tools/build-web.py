# -*- coding: utf-8 -*-
"""把 toc.json（逻辑数据：原始 PDF + 阅读器页码）编译成站点实际使用的 toc.js。

做两件事：
1. 大 PDF 按页切成约 5 MB 的小块，文件名带内容哈希（pdf/chunks/<name>-<序号>-<哈希>.pdf）。
   目的：绕开 GitHub 单文件 100 MiB 限制；一次只下载约 5 MB，首屏快；哈希命名可被 Service Worker 永久缓存。
2. 把每条目录记录改写成「分块文件 + 块内页码」，保留原始页码 srcPage 与块体积 bytes（用于页面提示）。
   不再引用的旧分块会被清理。

用法（在工作区根目录）：python 306-mini-book/tools/build-web.py
依赖：pypdf
"""
import io, json, os, glob, shutil, hashlib, logging

logging.disable(logging.WARNING)
from pypdf import PdfReader, PdfWriter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
SRCROOT = os.path.join(os.path.dirname(SITE), "原始资料")
PDFDIR = os.path.join(SITE, "pdf")
CHUNKDIR = os.path.join(PDFDIR, "chunks")
DATA = os.path.join(SITE, "assets", "data", "toc.json")
WEBDATA = os.path.join(SITE, "assets", "data", "toc.js")

TARGET = 5 * 1024 * 1024          # 每块目标体积
SMALL = 12 * 1024 * 1024          # 小于该体积不切块，直接使用原文件
MAXCHUNK = 90 * 1024 * 1024       # 单文件安全上限（GitHub 限制 100 MiB）

# 站点内的 pdf 文件 → 原始资料里的相对路径
FILE_SOURCES = {
    "pdf/xizong-physiology.pdf": "西综讲义PDF/physiology.pdf",
    "pdf/xizong-biochem.pdf": "西综讲义PDF/biochem.pdf",
    "pdf/xizong-pathology.pdf": "西综讲义PDF/pathology.pdf",
    "pdf/xizong-internal.pdf": "西综讲义PDF/internal.pdf",
    "pdf/xizong-surgery1.pdf": "西综讲义PDF/surgery1.pdf",
    "pdf/xizong-surgery2.pdf": "西综讲义PDF/surgery2.pdf",
    "pdf/kb-neike.pdf": "狂背讲义PDF/狂背【内科含诊断+部分外科】.pdf",
    "pdf/kb-jichu.pdf": "狂背讲义PDF/狂背【基础学科横向大串联】.pdf",
    "pdf/kb-waike.pdf": "狂背讲义PDF/狂背【外科+横向大串联 】.pdf",
}

os.makedirs(CHUNKDIR, exist_ok=True)
keep = set()
chunk_bytes = {}
mapping = {}
summary = []


def locate(rel):
    src = FILE_SOURCES.get(rel)
    if src:
        p = os.path.join(SRCROOT, src.replace("/", os.sep))
        if os.path.exists(p):
            return p
    p = os.path.join(SITE, rel.replace("/", os.sep))
    return p if os.path.exists(p) else None


def build_file(rel, src):
    size = os.path.getsize(src)
    reader = PdfReader(src)
    n = len(reader.pages)

    if size <= SMALL:
        dst = os.path.join(SITE, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst) or os.path.getsize(dst) != size:
            shutil.copyfile(src, dst)
        keep.add(rel)
        chunk_bytes[rel] = size
        mapping[rel] = [(rel, i + 1) for i in range(n)]
        summary.append((rel, n, size, 1, size))
        return

    per = max(2, int(TARGET / max(1, size / n)))
    base = os.path.splitext(os.path.basename(rel))[0]
    entries = [None] * n
    total = 0
    count = 0
    for idx, start in enumerate(range(0, n, per)):
        end = min(start + per, n)
        writer = PdfWriter()
        for i in range(start, end):
            writer.add_page(reader.pages[i])
        try:
            writer.compress_identical_objects()
        except Exception:
            pass
        buf = io.BytesIO()
        writer.write(buf)
        raw = buf.getvalue()
        digest = hashlib.sha1(raw).hexdigest()[:8]
        out = "pdf/chunks/%s-%02d-%s.pdf" % (base, idx + 1, digest)
        with open(os.path.join(SITE, out.replace("/", os.sep)), "wb") as fh:
            fh.write(raw)
        keep.add(out)
        chunk_bytes[out] = len(raw)
        total += len(raw)
        count += 1
        if len(raw) > MAXCHUNK:
            print("!! 分块体积超限:", out, len(raw))
        for i in range(start, end):
            entries[i] = (out, i - start + 1)
    mapping[rel] = entries
    summary.append((rel, n, size, count, total))


def original_file(entry):
    return entry.get("srcFile") or entry.get("file")


data = json.load(open(DATA, encoding="utf-8"))

needed = set()
for lecture in data["lectures"].values():
    for part in lecture["parts"]:
        for chapter in part["chapters"]:
            needed.add(original_file(chapter))
            for sec in chapter["sections"]:
                needed.add(original_file(sec))

for rel in sorted(needed):
    src = locate(rel)
    if not src:
        print("!! 找不到源文件:", rel)
        continue
    build_file(rel, src)

applied = 0
for lecture in data["lectures"].values():
    for part in lecture["parts"]:
        for chapter in part["chapters"]:
            for entry in [chapter] + list(chapter["sections"]):
                orig = original_file(entry)
                table = mapping.get(orig)
                if not table:
                    continue
                pg = entry.get("srcPage") or entry.get("page")
                if not isinstance(pg, int) or not (1 <= pg <= len(table)):
                    continue
                out, local = table[pg - 1]
                entry["srcPage"] = pg
                entry["srcFile"] = orig
                entry["file"] = out
                entry["page"] = local
                entry["bytes"] = chunk_bytes.get(out, 0)
                applied += 1

removed = 0
for path in glob.glob(os.path.join(CHUNKDIR, "*.pdf")):
    rel = "pdf/chunks/" + os.path.basename(path)
    if rel not in keep:
        os.remove(path)
        removed += 1
for path in glob.glob(os.path.join(PDFDIR, "*.pdf")):
    rel = "pdf/" + os.path.basename(path)
    if rel not in keep:
        os.remove(path)
        removed += 1

data["builtAt"] = "2026-11-15"
data["chunked"] = True
with open(WEBDATA, "w", encoding="utf-8") as fh:
    fh.write("/* 自动生成：由 tools/build-web.py 从 toc.json 编译，请勿手改 */\n")
    fh.write("window.TOC_DATA = ")
    json.dump(data, fh, ensure_ascii=False, indent=1)
    fh.write(";\n")

total_all = 0
print("%-30s %6s %10s %6s %10s" % ("源文件", "页数", "源体积", "块数", "分块体积"))
for rel, n, size, count, total in summary:
    total_all += total
    print("%-30s %6d %8.1fMB %6d %8.1fMB" % (os.path.basename(rel), n, size / 1048576, count, total / 1048576))
print("合计输出体积: %.1f MB" % (total_all / 1048576))
print("条目改写:", applied, "清理旧文件:", removed)
print("toc.js:", os.path.getsize(WEBDATA), "bytes")
print("分块总数:", len(glob.glob(os.path.join(CHUNKDIR, "*.pdf"))))
