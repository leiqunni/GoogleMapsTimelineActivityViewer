# Google Maps Timeline Activity Viewer

## 概要
Google Maps Timeline Activity Viewerは、Google Mapsのタイムラインから取得した位置情報履歴データを視覚化・分析するためのツールです。あなたの移動履歴やパターンを追跡し、日々の活動に関する洞察を得ることができます。

![Image](https://github.com/user-attachments/assets/2e48a9c2-60ab-40d1-a0c2-d68a6621b2fb)

## 機能
- Google Mapsのタイムラインデータを地図上で視覚化
- 時間経過に伴う活動パターンの分析
- 日付範囲、活動タイプ、場所によるデータのフィルタリング
- さらなる分析のためのフィルタリングされたデータのエクスポート
- 移動履歴や訪問場所に関する統計情報の表示

## 使い方
1. まず、スマートフォンのGoogle Mapsのアプリケーションから`location-history.json`をエクスポートします
2. このリポジトリをクローンまたはダウンロードします
3. `index.html`ファイルでGoogle Maps APIキーを設定します
4. ローカルウェブサーバーを起動します（以下の手順を参照）
5. ブラウザでアプリケーションを開き、JSONデータをインポートします
6. インタラクティブなインターフェースで位置情報履歴を探索します

### Google Maps APIキーの設定
1. テキストエディタで`index.html`ファイルを開きます
2. 「YOUR API KEY」の部分にGoogle Maps APIキーを入力します
3. ファイルを保存します

注意：このアプリケーションで地図を正しく表示するには、有効なGoogle Maps APIキーが必要です。APIキーは[Google Cloud Platform Console](https://console.cloud.google.com/)から取得できます。

## アプリケーションの実行
PHPのビルトインウェブサーバーを使用して実行できます。

### Windowsの場合：

#### PHPビルトインウェブサーバーの使用：
```
php -S 0.0.0.0:8888
```

ウェブサーバーを起動した後、ブラウザを開いて以下のURLにアクセスしてください：
```
http://localhost:8888/
```

## データプライバシー
このアプリケーションは位置情報データをローカルデバイス上で処理します。データが外部サーバーに送信されることはなく、位置情報履歴のプライバシーが確保されます。

## 必要環境
- JavaScriptが有効な最新のウェブブラウザ
- `location-history.json`という名前のGoogle Mapsタイムラインデータ（JSON形式）
- Google Maps APIキー
- ローカルウェブサーバー実行用のPHP

## ライセンス
このプロジェクトはMITライセンスの下で公開されています - 詳細はLICENSEファイルを参照してください。

## 貢献
貢献大歓迎です！プルリクエストを気軽に提出してください。

## サポート
問題が発生した場合や質問がある場合は、GitHubリポジトリでIssueを開いてください。

## 変更履歴
```
コードの重複と冗長な部分を削って。
```

主な重複と冗長な部分を削除しました：

### 主な変更点：
1. 座標解析の統一
    * `parseCoordinates` 関数を統一し、各パーサー関数での重複を削除
2. データ解析の統合
    * `createLocationObject` 関数でvisitとactivityオブジェクト作成を統一
    * `parseDataSegment` 関数で異なるデータ形式の解析を統合
    * `parseTimelinePath` 関数でタイムラインパス処理を統一
3. 重複コードの削減
    * 座標境界の拡張処理を統合
    * マーカー作成とクリア処理の統合
    * イベントハンドラー設定の配列化
4. 関数の簡素化
    * `createPlaceDetailsInfoWindow` で配列フィルターを使った条件付きコンテンツ生成
    * `Object.assign` でスタイル設定を簡素化
    * スプレッド演算子でマーカーとポリラインのクリアを統合
5. 条件処理の最適化
    * 三項演算子とOptional chainingの活用
    * 重複した条件分岐の統合
6. 構造の改善
    * 関連する機能をグループ化
    * イベントハンドラーの配列による一括設定
    * 初期化処理の統合

このクリーンアップにより、コードサイズが大幅に削減され、保守性が向上しました。元の機能は全て保持されています。

