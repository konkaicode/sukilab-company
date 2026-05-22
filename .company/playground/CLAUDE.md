# プレイグラウンド部署

## 役割
実験・プロトタイプ制作の自由な場所。LP制作・ツール試作・デザイン検証など、他の部署の枠に収まらない試みをここで行う。成功したプロジェクトは独立部署へ昇格する可能性あり。

## 行動指針
- とにかく作ってみる。完璧より完成を優先
- プロジェクト単位で `projects/{project-name}/` フォルダを作成する
- 各プロジェクトには `README.md` を必ず作成する
- 完成・成熟したものは適切な部署に移管することを検討する

## フォルダ構成
- `projects/` - 進行中・完成プロジェクト（1プロジェクト1フォルダ）

## 現在のプロジェクト
| プロジェクト | フォルダ | 状態 | 概要 |
|-------------|---------|------|------|
| 自己紹介LP | `projects/my-lp/` | 進行中 | Verdana Health デザインシステムを使った1枚ペラLP |
| X発信用画像生成 | `projects/x-image-generator/` | 運用中 | HTML + Playwright で X 投稿用図解画像を生成 |

---

## X発信用画像生成 — 制作フロー

### 方針
**HTMLキャンバス（アプローチA）のみを使用。** Figmaは使用しない。
Playwright でブラウザをそのまま撮影するため、CSS・フォント・画像が完全に再現される。

---

### ファイル構成

```
x-image-generator/
├── CLAUDE.md                          ← プロジェクトルール（必ず読む）
├── x-image-design-system-DESIGN.md   ← デザインシステム定義（新規HTML作成時に参照）
├── konkai-transparent.png             ← キャラクター画像（マスター）
├── img_1.jpg 〜 img_4.jpg             ← 参考ポスト画像
├── screenshot.py                      ← Playwright キャプチャスクリプト
├── approach-a-canvas/
│   ├── konkai-transparent.png         ← サーバー用コピー（必須。マスターと同期する）
│   └── playwright-tips-v2.html        ← 現行テンプレート（新規作成のベース）
└── screenshots/                       ← 生成済み PNG の保存先
    ├── slide-1.png
    ├── slide-2.png
    └── ...
```

---

### 制作手順（全体フロー）

#### Step 1 — ポスト内容を整理する
- ポストのテキストを読んで、**4枚構成**（問題提起 / Before-After / 詳細 / まとめ）に分解する
- スライドパターンは `x-image-design-system-DESIGN.md` の **Pattern A〜E** を参照
- 各スライドのキャラクター（のるまん）吹き出しセリフを決める（30文字以内・カジュアル）

#### Step 2 — HTML を作成・更新する
- `playwright-tips-v2.html` をベースにコピーして編集する
- デザインMDのルールを守る：
  - `line-height: 1.6`（160%）全テキスト統一
  - padding 階層: スライド48px → カード40/48px → アイテム14/20px
  - キャラクター行は `position: absolute; bottom: 28px; right: 40px;`（Auto Layout外）
- 保存先: `approach-a-canvas/[ポスト名].html`
- **キャラクター画像を追加・変更した場合は `approach-a-canvas/` にもコピーする**

#### Step 3 — ローカルサーバーを起動する

```
! python -m http.server 8080 --directory "C:\cc-company\.company\playground\projects\x-image-generator\approach-a-canvas"
```

ブラウザで確認: `http://localhost:8080/[ファイル名].html`

> ⚠️ `file://` での直接オープンは不可。Google Fonts・画像パス・clipboard API が正しく動かない。

#### Step 4 — Playwright でスクリーンショットを撮る

```
! "C:\Users\konka\AppData\Local\Programs\Python\Python313\python.exe" "C:\cc-company\.company\playground\projects\x-image-generator\screenshot.py"
```

全スライドを `screenshots/slide-1.png` 〜 に保存。特定のスライドのみの場合:

```
! "C:\Users\konka\AppData\Local\Programs\Python\Python313\python.exe" "C:\cc-company\.company\playground\projects\x-image-generator\screenshot.py" 1
```

---

### 注意事項

| 項目 | 内容 |
|------|------|
| Python パス | `Python313` を**絶対パスで指定**する。`python` コマンドは browser-use 仮想環境を優先するため動かない |
| 画像コピー | キャラクター画像は `approach-a-canvas/` にも同じファイルを置く（サーバールートが `approach-a-canvas/` のため） |
| サーバーURL | `http://localhost:8080/[ファイル名].html`（`approach-a-canvas/` を含まない） |
| screenshot.py の URL | `http://localhost:8080/playwright-tips-v2.html`（ファイルごとに変更が必要） |

---

### デザインシステムの概要（詳細は DESIGN.md 参照）

| 要素 | 値 |
|------|-----|
| スライドサイズ | 1200 × 675 px（16:9） |
| 背景 | `#E4E4EE`（ライトパープルグレー） |
| アクセントカラー | `#F97316`（オレンジ） |
| フォント | Noto Sans JP（Black / Bold / Medium） |
| line-height | **160% 統一** |
| カード角丸 | 28px |
| キャラクター | `konkai-transparent.png`（右下絶対位置・translateY(22px) で足を隠す） |
