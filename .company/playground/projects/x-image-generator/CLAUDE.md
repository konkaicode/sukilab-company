# X Image Generator — プロジェクトルール

## 概要
X（Twitter）発信用の図解画像を生成するプロジェクト。
HTMLテンプレートをベースに画像を作成する。

## HTMLファイル作成・更新時のルール

**HTMLファイルを新規作成 or 更新したら、必ずこのメッセージを添える：**

> ブラウザで確認するには、プロンプトに以下を入力してローカルサーバーを起動してください：
>
> ```
> ! python -m http.server 8080 --directory "C:\cc-company\.company\playground\projects\x-image-generator"
> ```
>
> 起動後、ブラウザで `http://localhost:8080/approach-a-canvas/[ファイル名].html` を開いてください。
> 終了は `Ctrl+C` です。

**なぜサーバーが必要か：**
- `file://` で開くとフォント（Google Fonts）の読み込みが失敗する
- `../konkai-transparent.png` などの親ディレクトリ参照がHTTPサーバーで機能するにはルートを `x-image-generator` にする必要がある
- ベースディレクトリは `approach-a-canvas` ではなく **`x-image-generator`** にすること

**スライドの保存方法：**
ブラウザのUIボタン → Playwright コマンドが表示される → プロンプトに貼り付けて実行

```
! python "C:\cc-company\.company\playground\projects\x-image-generator\screenshot.py"       # 全スライド
! python "C:\cc-company\.company\playground\projects\x-image-generator\screenshot.py" 1    # スライド1のみ
```

保存先: `x-image-generator/screenshots/`

## ファイル構成
```
x-image-generator/
├── CLAUDE.md                      ← このファイル
├── x-image-design-system-DESIGN.md  ← デザインシステム定義
├── konkai-transparent.png         ← キャラクター画像
├── noruman-leg.png                ← 旧キャラクター画像
├── approach-a-canvas/             ← HTMLテンプレート（メイン）
│   ├── template.html
│   ├── playwright-tips.html       ← v1
│   └── playwright-tips-v2.html    ← v2（現行）
└── approach-b-figma/              ← Figmaスクリーンショット保管
```

## デザインシステム
詳細は `x-image-design-system-DESIGN.md` を参照。
新しいスライドを作るときは必ずこのMDを読み込む。
