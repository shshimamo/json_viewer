# jo - plan

JSON ファイルをブラウザでインタラクティブに閲覧する CLI ツール。[mo](https://github.com/k1LoW/mo) の JSON 版。

## 現状 (最小構成完了)

- `main.go`: Go サーバー。JSON ファイルを読み込み `/api/content` で配信。`frontend/dist` を embed
- `frontend/src/App.tsx`: React + Vite + TypeScript。ツリービュー（開閉可能）
- `frontend/src/index.css`: ダークテーマ (Catppuccin Mocha)
- `frontend/dist/index.html`: プレースホルダー（要ビルド）

### 確認方法

```bash
cd frontend && pnpm install && pnpm build
go run . /path/to/file.json
```

---

## フェーズ 1: 基本機能

### 1-1. stdin サポート
- `cat file.json | jo` で動作する
- mo の `cmd/stdin.go` 参照

### 1-2. ライブリロード
- ファイル変更を検知してブラウザを自動更新
- SSE (Server-Sent Events) で実装
- mo の `/api/events` エンドポイント参照

### 1-3. JSONPath 表示
- キー/値にホバーまたはクリックで JSONPath をツールチップ表示
- クリップボードにコピー

### 1-4. コピー機能
- 値のコピー（文字列/数値/boolean）
- サブツリーを JSON としてコピー
- JSONPath をコピー

### 1-5. 展開/折りたたみ操作
- 「すべて展開」「すべて折りたたみ」ボタン
- キーボードショートカット（e: expand all, c: collapse all）

---

## フェーズ 2: 検索

### 2-1. キー/値の検索
- ヘッダーに検索バー
- キーまたは値を検索してハイライト
- マッチした行を自動展開
- ショートカット: `/` でフォーカス、Esc でクリアー

---

## フェーズ 3: 表示オプション

### 3-1. Raw JSON 表示トグル
- ツリービュー ↔ フォーマット済みテキスト切り替え
- mo の RawToggle 参照

### 3-2. テーマトグル
- ダーク / ライト切り替え
- CSS 変数で管理

### 3-3. フォントサイズトグル
- 小 / 中 / 大

---

## フェーズ 4: サーバー機能 (mo 準拠)

### 4-1. バックグラウンド起動
- コマンド実行後すぐにシェルに戻る（mo と同じ動作）
- フォアグラウンドは `--foreground` フラグ

### 4-2. 複数ファイル・シングルサーバー
- すでにサーバーが起動中なら既存セッションにファイル追加
- サイドバーでファイル切り替え
- `--port` / `-p` フラグ

### 4-3. --status / --shutdown / --restart
- mo と同様の管理コマンド

---

## 技術スタック

| 層 | 技術 |
|---|---|
| サーバー | Go (標準ライブラリ + `pkg/browser`) |
| フロントエンド | React 18 + TypeScript + Vite |
| スタイル | CSS (Catppuccin Mocha テーマ) |
| embed | Go `embed` パッケージ |

## 優先順位

```
フェーズ1 (stdin, ライブリロード, JSONPath, コピー, 展開操作)
  → フェーズ2 (検索)
    → フェーズ3 (表示オプション)
      → フェーズ4 (サーバー機能)
```
