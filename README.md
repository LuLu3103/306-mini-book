# 306-mini-book · 西综学习中心

> 面向西医综合考研人群的单页学习入口：把每日计划、口诀题库、工具面板等高频去处收在第一屏，再用「西综讲义」「狂背讲义」两套可展开目录，把 9 册讲义变成「讲义 → 科目 → 章 → 节」的可展开目录，点小节直达页码。

- **形态**：纯静态单页，无框架、无构建、无后端；推送即部署到 GitHub Pages
- **内容**：2 套讲义 / 8 部分 / 56 章 / 424 节 / 1471 页 / 9 册 PDF
- **打开方式**：点击小节 → 新标签页打开该页所在的 PDF 分块，并定位到对应页码
- **站内搜索**：顶栏搜索框同时检索「章」与「节」，回车即打开对应页；也支持 `?q=血压` 深链接
- **三层目录**：先选讲义，再选科目（西综：生理 / 病理 / 内科 / 外科 / 生化；狂背：内科 / 外科 / 基础学科），只显示当前科目的章节，避免一次摊开几百条
- **体积策略**：PDF 按页切成约 5 MB 的小块（共 127 块），首屏只下载当前这一块

## 为什么 PDF 要切块

原始 9 册 PDF 合计约 604 MB，其中 3 册单文件超过 GitHub 的 100 MiB 限制，直接放仓库既推不上去，打开一页也要等整本下载。因此构建脚本把它们按页切成小块：

| 指标 | 数值 |
|---|---|
| 分块总数 | 127 块 |
| 单块平均 | 约 5 MB |
| 单块最大 | 约 11 MB（小于 100 MiB 限制） |
| 首次打开一节 | 只下载 0.7–11 MB，通常 1–3 秒 |
| 再次打开 | 浏览器缓存 / Service Worker 直接命中，不重新下载 |

分块文件名带**内容哈希**（如 `xizong-physiology-03-6f2a1b9c.pdf`），内容一变文件名就变，因此可以安全地长期缓存。

### 缓存是怎么做的

1. **悬停预取**：鼠标移到小节上（或键盘聚焦）时，页面就开始预取该分块，点下去往往已经下完。
2. **Service Worker**：`sw.js` 只接管同源 `/pdf/chunks/` 的请求，命中缓存直接返回整份响应；未命中则下载后写入 Cache Storage，下次跨会话免下载。上限 100 块，超出按写入顺序淘汰最早的。
3. **兜底**：Service Worker 不可用（file:// 打开、隐私模式、老浏览器）时自动退回普通网络请求 + 浏览器 HTTP 缓存，功能不受影响。
4. **一键清缓存**：「使用说明」弹层里有「清除已缓存的讲义分块」，会清空 Cache Storage 并注销 Service Worker，用于排查缓存问题。

## 目录结构

```text
306-mini-book/                     ← 仓库根目录（Pages 站点根目录）
├── index.html                     # 单页：品牌栏、快捷入口、讲义选择、目录面板、使用说明
├── sw.js                          # Service Worker：/pdf/chunks/ 的持久缓存
├── .nojekyll                      # 关闭 Jekyll，按原样发布静态文件
├── .github/workflows/pages.yml    # push 到 main 自动部署到 GitHub Pages
├── assets/
│   ├── css/style.css              # 设计令牌、组件、响应式、动效降级
│   ├── js/app.js                  # 目录渲染、展开、深链接、预取、SW 注册、弹层
│   └── data/
│       ├── toc.json               # 逻辑源数据：原始 PDF + 阅读器页码
│       └── toc.js                 # 页面实际读取：分块路径 + 块内页码 + 块体积
├── pdf/
│   ├── chunks/*.pdf               # 127 个按页切好的分块（大头都在这里）
│   ├── kb-neike.pdf               # 狂背三册体积小，整册直出
│   ├── kb-jichu.pdf
│   └── kb-waike.pdf
├── docs/
│   ├── design-spec.html           # 设计交付文档：信息架构图、色彩、字体、组件状态、交互
│   └── screenshots/               # 桌面 / 移动端高保真截图
├── tools/
│   ├── build-toc.py               # 解析原始 PDF（书签 + 目录页）→ toc.json
│   └── build-web.py               # toc.json + 原始 PDF → 分块 + toc.js
└── README.md
```

## 部署到 GitHub Pages

站点是纯静态文件，仓库根目录就是站点根目录，**不需要 Node、不需要构建**。

当前仓库已启用 **GitHub Actions** 部署：`.github/workflows/pages.yml` 会在 push 到 `main` 时自动发布（Settings → Pages → Source 需为 **GitHub Actions**）。

### 方式一：分支部署（零配置，备选）

1. 仓库 **Settings → Pages**
2. **Source** 选 **Deploy from a branch**
3. **Branch** 选 `main`，目录选 **/ (root)**，点 **Save**
4. 等 1 分钟左右，访问 `https://lulu3103.github.io/306-mini-book/`

之后每次 `git push` 到 `main`，Pages 都会自动重新发布，不需要额外配置。

### 方式二：GitHub Actions 自动部署（当前采用）

如果希望走 Actions，把下面内容保存为 `.github/workflows/pages.yml` 并提交（注意：推送这个文件要求令牌具备 **workflow** 权限，或直接在 GitHub 网页上创建该文件），再把 Pages 的 Source 改成 **GitHub Actions**：

```yaml
name: Deploy to Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

两种方式不要同时开；日常用方式一最简单。

> 站点必须放在**仓库根目录**（`index.html` 在根上）。如果是 monorepo 子目录，需要改用自定义 Actions 把该子目录作为产物上传。

## 本地预览

```bash
cd 306-mini-book
python -m http.server 8099
# 打开 http://127.0.0.1:8099/
```

也可以直接双击 `index.html`：页面不依赖 `fetch`、ES Module 或构建产物（目录数据用普通 `<script>` 加载，PDF 走相对路径）。只是 `file://` 下 Service Worker 不可用，缓存退化为浏览器 HTTP 缓存。

## 使用方式

- **快捷入口**：每日计划、口诀/题库、工具面板、Github，全部新标签打开。
- **两套讲义**：点「西综讲义」或「狂背讲义」展开目录；再次点击同一张卡取消选中，回到空状态。
- **科目切换**：选中讲义后，目录头部出现科目标签（西综：生理学 / 病理学 / 内科学 / 外科学 / 生物化学；狂背：内科 / 外科 / 基础学科），点一下就只看该科目；章节序号从 01 重新计数。
- **章 → 节**：点章节行展开小节；「全部展开 / 全部收起」作用于当前科目。
- **跳转**：点小节 → 打开讲义对应页；章内没有小节时会提示「本章未细分小节，直接打开第 N 页」。
- **页码含义**：目录里的 `P12` 与跳转参数都是 **PDF 阅读器页码**，不是纸书印刷页码。
- **深链接**：`?lecture=xizong`、`?lecture=kuangbei&all=1`（选中讲义并全部展开）、`?lecture=xizong&part=bingli`（直接打开病理学），方便分享。
- **站内搜索**：顶栏输入「血压」「肺栓塞」等关键词即可定位到章 / 节；`Enter` 打开第一条，`↑↓` 选择，`/` 快速聚焦，`Esc` 关闭。
- **搜索深链接**：`?q=血压` 打开页面即展示搜索结果。

## 维护：改目录 / 换 PDF

需要 Python 3 与 `pypdf`（`pip install pypdf`），并且工作区里保留 `原始资料/` 下的原始 PDF。

```bash
# 1) 从原始 PDF 重新抽取目录（书签 + 目录页）→ assets/data/toc.json
python 306-mini-book/tools/build-toc.py

# 2) 按页切块 + 生成页面读取的 assets/data/toc.js
python 306-mini-book/tools/build-web.py
```

`tools/build-web.py` 会做这些事：

- 读取 `toc.json` 里的「原始文件 + 阅读器页码」；
- 大于 12 MB 的 PDF 按约 5 MB 切块（文件名带内容哈希），小于的整册直出；
- 把每条记录改写成「分块文件 + 块内页码」，并附上 `srcPage`（原始页码）与 `bytes`（块体积）；
- 清掉不再被引用的旧分块；
- 输出 `assets/data/toc.js`。

> `toc.json` 与 `toc.js` 是同一份数据的两种形态：前者给人看、给人改，后者给浏览器读。**不要只改 toc.js**，重跑 `build-web.py` 即可保持一致。

### 数据字段（toc.js）

| 字段 | 说明 |
|---|---|
| `lectures.{id}.id / name` | 讲义 id 与显示名，id 需与讲义卡的 `data-lecture` 一致 |
| `parts[].name / pages` | 部分（科目）名称、页数 |
| `chapters[].title / page / file` | 章标题、块内页码、分块文件 |
| `chapters[].srcPage / srcFile` | 原始页码、原始 PDF（页面上显示的 P 数字用 `srcPage`） |
| `sections[].bytes` | 该分块体积，用于生成悬停提示 |
| `sections: []` | 章内没有细分小节，页面提示直接打开该页 |

## 常见问题

**打开一节还是有点慢？**
首次打开要下载对应的那一块（0.7–11 MB）。鼠标先在小节上停一下触发预取，或反复看同一章（同块会命中缓存）都会更快。

**改了 PDF 但页面还是旧内容？**
重新跑 `build-web.py`：分块文件名带内容哈希，会生成新文件；旧文件被清理、旧缓存自然失效。必要时在「使用说明」里点「清除已缓存的讲义分块」。

**Service Worker 更新了怎么让用户拿到新版？**
改 `sw.js` 里的 `CACHE = "306-pdf-chunks-v1"` 版本号即可，激活时会清掉旧版本缓存。

**仓库体积会不会超限？**
当前约 640 MB，在 GitHub 仓库建议上限（1 GB）和 Pages 站点上限（1 GB）之内。若继续增大，建议把 `pdf/` 改为 GitHub Release 资产或 Git LFS 托管，再修改 `build-web.py` 里的路径前缀。

## 相关文档

- [设计交付文档](docs/design-spec.html)：定位、信息架构图、色彩与字体规范、组件状态、交互与响应式说明
- 截图：[桌面空状态](docs/screenshots/desktop-empty.png)、[桌面目录](docs/screenshots/desktop-toc.png)、[桌面展开](docs/screenshots/desktop-expanded.png)、[手机空状态](docs/screenshots/mobile-empty.png)、[手机目录](docs/screenshots/mobile-toc.png)
