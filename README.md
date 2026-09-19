# Hexwebmap

打开即用的全球地图，托管在 **GitHub Pages**。不需要 `npm install`，没有后端。

在线地址：

- https://andyccr.github.io/Hexwebmap/
- https://andyccr.com/Hexwebmap/

## 架构

仓库根目录就是网站（单一源）：

```
index.html / 404.html   入口
css/ js/ vendor/        样式、模块、本地 MapLibre
sw.js + manifest        可选离线壳
tests/*.mjs             几何 / hash / XSS 单测（CI 发布前跑）
.nojekyll               禁止 Jekyll 改写
docs/                   根目录镜像，兼容 Pages「/docs」
```

浏览器直连 OpenFreeMap 瓦片、Photon / Nominatim 搜索、OSRM 路线。搜索按名称匹配与距当前视野的距离排序；路线用 Douglas–Peucker 简化后再绘制。

## Pages 设置

1. **GitHub Actions**（推荐）：`.github/workflows/pages.yml` 跑测试并发布 `_site`
2. **Deploy from a branch**：Branch `main`，Folder **`/ (root)`**

## 本地预览

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

打开 http://127.0.0.1:8080/

```bash
node tests/geo.test.mjs && node tests/hash.test.mjs && node tests/dom.test.mjs
```

## 许可

GNU Affero General Public License v3。地图数据 © OpenStreetMap 贡献者（ODbL）。
