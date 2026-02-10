# Google Sheets連携セットアップガイド

## 1. GCPプロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
   - プロジェクト名: `claude-usage-tracker` (任意)
3. プロジェクトを選択

## 2. Google Sheets API の有効化

1. 左メニューから「APIとサービス」→「ライブラリ」を選択
2. "Google Sheets API" を検索
3. 「有効にする」をクリック
4. 同様に "Google Drive API" も有効化（推奨）

## 3. サービスアカウントの作成

1. 左メニューから「APIとサービス」→「認証情報」を選択
2. 「認証情報を作成」→「サービスアカウント」を選択
3. サービスアカウント情報を入力:
   - 名前: `claude-usage-sheets`
   - ID: 自動生成される
   - 説明: `Claude Code usage tracker`
4. 「作成して続行」をクリック
5. ロール選択は **スキップ可能**（閲覧者でOK）
6. 「完了」をクリック

## 4. サービスアカウントキーのダウンロード

1. 作成したサービスアカウントをクリック
2. 「キー」タブを選択
3. 「鍵を追加」→「新しい鍵を作成」
4. キーのタイプ: **JSON** を選択
5. 「作成」をクリック
   - JSONファイルが自動ダウンロードされます
6. ダウンロードしたファイルを以下にコピー:
   ```bash
   cp ~/Downloads/your-project-xxxxx.json /Users/sooh/Devs/claude_usage/credentials/service-account.json
   ```

## 5. Google Spreadsheetの作成と共有

1. [Google Sheets](https://sheets.google.com) で新しいスプレッドシートを作成
2. タイトル: `Claude Code Usage Stats` (任意)
3. URLから **スプレッドシートID** をコピー
   - URL形式: `https://docs.google.com/spreadsheets/d/【このID】/edit`
   - 例: `1aBcD3FgHiJkLmNoPqRsTuVwXyZ`
4. 「共有」ボタンをクリック
5. サービスアカウントのメールアドレスを追加
   - 形式: `claude-usage-sheets@your-project-id.iam.gserviceaccount.com`
   - JSONファイル内の `client_email` フィールドで確認可能
   - 権限: **編集者**
6. 「送信」をクリック

## 6. .env ファイルの編集

```bash
cd /Users/sooh/Devs/claude_usage
nano .env  # または好きなエディタで編集
```

以下の内容に編集:
```
GOOGLE_SHEET_ID=【コピーしたスプレッドシートID】
GOOGLE_CREDENTIALS_PATH=credentials/service-account.json
```

## 7. 動作確認

```bash
# ドライラン（Sheetsに書き込まない）
uv run python -m src.aggregator --dry-run

# 実際にアップロード（テストデータがある場合）
uv run python -m src.aggregator --date 2026-02-10
```

## トラブルシューティング

### エラー: "gspread.exceptions.APIError: [403]"
- サービスアカウントがスプレッドシートに共有されていない
- サービスアカウントのメールアドレスを再確認

### エラー: "google.auth.exceptions.DefaultCredentialsError"
- JSONキーファイルのパスが間違っている
- `.env` ファイルの設定を確認

### エラー: "GOOGLE_SHEET_ID environment variable not set"
- `.env` ファイルが読み込まれていない
- ファイル名が `.env.example` のままになっていないか確認

## サービスアカウントのメールアドレス確認方法

```bash
cat credentials/service-account.json | grep client_email
```

または:

```bash
python3 -c "import json; print(json.load(open('credentials/service-account.json'))['client_email'])"
```
