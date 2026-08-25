# Hexwebmap

打开即用的全球地图，托管在 **GitHub Pages**。不需要 `npm install`，没有后端。

在线地址：

- https://andyccr.github.io/Hexwebmap/
- https://andyccr.com/Hexwebmap/

## 架构

仓库根目录就是网站：

```
index.html          ← 入口（必须存在，否则 Pages/Jekyll 会去渲染 README）
.css / js / vendor  ← 样式、逻辑、本地 MapLibre
.nojekyll           ← 禁止 Jekyll 改写静态文件
docs/               ← 与根目录同步的镜像（Settings 选 /docs 时也可用）
```

浏览器直连 OpenFreeMap 瓦片、Photon / Nominatim 搜索、OSRM 路线。

## Pages 设置（重要）

任选其一：

1. **GitHub Actions**（推荐）：用本仓库 `pages.yml` 发布 `_site`
2. **Deploy from a branch**：Branch `main`，Folder **`/ (root)`**  
   根目录已有 `index.html` + `.nojekyll`，不要只依赖 README

若站点变成 README 文档页而不是地图，说明 Pages 仍在用 Jekyll 渲染 README，请改成上述设置之一。

## 本地预览

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

打开 http://127.0.0.1:8080/

## 许可

GNU Affero General Public License v3。地图数据 © OpenStreetMap 贡献者（ODbL）。
