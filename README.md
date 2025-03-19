# Google マップ タイムライン アクティビティ ビューア

このツールは、iOS の Google マップ アプリからエクスポートされた JSON を使用して、Google マップ タイムライン データを視覚化します。[kurupted](https://github.com/kurupted/google-maps-timeline-viewer) による元のプロジェクトを基に、iOS 形式で動作するようにいくつかの改善と修正が加えられています。

これの大部分は、元のプロジェクトの上に GPT/Claude によって生成されたスロップであることに注意してください。

## 手順

### 1. リポジトリをクローンする

```bash
git clone https://github.com/leiqunni/GoogleMapsTimelineActivityViewer.git
```

### 2. Google マップ API キーを取得する

1. [このガイド](https://github.com/kurupted/google-maps-timeline-viewer?tab=readme-ov-file#obtain-a-google-maps-api-key) の手順に従って、Google マップ API キーを生成します。
2. `index.html` の `YOUR_API_KEY` を API キーに置き換えます。

### 3. カスタム マップを作成する

1. [このガイド](https://developers.google.com/maps/documentation/javascript/cloud-customization/map-styles-leg#create-style) に従って、カスタム マップ スタイルを作成します。
2. `timeline-viewer.js` の `MY_MAP_ID` をカスタム マップ ID に置き換えます。

### 4. タイムライン データを追加する

1. iOS の Google マップ アプリからタイムライン データをエクスポートします。
2. エクスポートした JSON ファイルをプロジェクト フォルダにコピーします。
3. ファイル名を `location-history.json` に変更します。

### 5. ビューアーを実行します

1. プロジェクト ディレクトリでローカル サーバーを起動します:
```bash
python -m http.server 8000
```

2. ブラウザーを開いて [http://localhost:8000](http://localhost:8000) に移動します。

## スクリーンショット

![image](https://github.com/epk/google-maps-timeline-viewer/raw/main/screenshot.png?raw=true)
