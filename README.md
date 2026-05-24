# jo

JSON ビューア。ファイルをブラウザで開いてツリー表示・テーブル表示で確認できる。

## インストール

```bash
make build
cp jo /usr/local/bin/jo  # または任意の PATH 上のディレクトリ
```

## 使い方

```bash
jo file.json              # ブラウザで開く
jo file1.json file2.json  # 複数ファイルをサイドバーに追加
jo file.json              # サーバー起動済みならファイルだけ追加
```

- ファイルをドロップ、または JSON をペースト（Ctrl+V / Cmd+V）でも追加できる
- 保存済みのファイルは `~/.jo/files/` に保存される

## テンプレート（enum 変換）

`~/.jo/templates/` に YAML ファイルを置くと、画面上部のセレクタで選択して enum 値を任意のラベルに変換できる。

### フォーマット

```yaml
# common: キー名ベースで適用（すべての "status" フィールドに適用）
common:
  status:
    active: "稼働中"
    planning: "計画中"
    done: "完了"

# fields: ドット区切りのパスで特定フィールドに適用（common より優先）
# * でワイルドカード指定可能
fields:
  - path: "user.status"
    map:
      active: "ログイン中"
  - path: "departments.*.status"
    map:
      active: "進行中"
```

`fields` のパスは**末尾一致**で判定される。フルパスを書く必要はなく、末尾が一致すれば適用される。

```
# company.departments.projects.status にマッチする書き方（すべて同じ）
projects.status
departments.projects.status
company.departments.projects.status
```

短く書けるが、別の場所に同名のパスがある場合は意図せずマッチすることがある。その場合はより長いパスで絞り込む。

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `JO_DIR` | `~/.jo/files/` | 保存ファイルの置き場所 |
| `JO_TEMPLATE_DIR` | `~/.jo/templates/` | テンプレートの置き場所 |

## 開発

```bash
make build    # フロントエンド + バックエンドをビルド
make restart  # サーバーを停止してビルドし直す
```
