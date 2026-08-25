# Hexwebmap

打开即用的全球地图网站，托管在 **GitHub Pages**。  
**不需要安装 Node、不需要后端、不需要 `npm install`。**

在线地址：

- https://andyccr.github.io/Hexwebmap/
- 或自定义域名：https://andyccr.com/Hexwebmap/

## 架构（纯静态）

```
浏览器打开 Pages URL
  └── docs/ 静态文件
        ├── index.html / css / js（本仓库）
        ├── MapLibre GL ← jsDelivr CDN
        ├── 矢量瓦片    ← OpenFreeMap
        ├── 搜索        ← Photon + Nominatim
        └── 路线        ← 公共 OSRM
```

仓库里就是最终页面。GitHub Pages 直接托管 `docs/`，没有构建步骤。

| 路径 | 作用 |
| --- | --- |
| `docs/index.html` | 页面骨架 |
| `docs/css/app.css` | OSM 风格界面 |
| `docs/js/*.js` | 地图、搜索、路线（ES modules） |

## 本地预览（可选）

因为用了 ES modules，用任意静态服务器打开即可，例如：

```bash
python3 -m http.server 8080 --directory docs
```

然后访问 http://127.0.0.1:8080 — **仍然不需要 npm**。

## 启用 Pages

仓库 **Settings → Pages**：

1. Source: **Deploy from a branch**，Branch: `main`，Folder: `/docs`  
   或
2. Source: **GitHub Actions**（本仓库已带 `pages.yml`，推送 `main` 即发布 `docs/`）

## 功能

- 全球 OSM Liberty 矢量底图，可切换 Bright / 深色 / HOT / 地形 / 卫星等
- 中英文搜索、点击逆地理、测距、定位、驾车/步行/骑行路线
- 分享链接：`#map=zoom/lat/lon&s=liberty`

## 许可

GNU Affero General Public License v3。地图数据 © OpenStreetMap 贡献者（ODbL）。
