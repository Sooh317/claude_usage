# Claude Code Usage Tracker

Claude CodeのOpenTelemetryテレメトリを活用し、日次使用統計を自動でGoogle Sheetsに記録するシステム。

## 特徴

- 🔄 リアルタイムでOTLPテレメトリを受信・保存
- 📊 日次で自動集計してGoogle Sheetsに記録
- 🚀 Docker不要、macOS + Python + uv で完結
- ⚙️ launchdで自動起動・定期実行

## アーキテクチャ

```
Claude Code (OTel env vars)
    ↓ OTLP HTTP/JSON (localhost:4318)
Python FastAPI Receiver (launchd常駐)
    ↓ 日次JSONLファイルに書き込み
data/YYYY-MM-DD.jsonl
    ↓ 毎日23:59にlaunchdが起動
Python Aggregator → Google Sheets API
    ↓
Google Spreadsheet (1日1行)
```

## セットアップ

### 前提条件

- macOS (arm64)
- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) インストール済み

### インストール

```bash
# リポジトリをクローン
git clone git@github.com:Sooh317/claude_usage.git
cd claude_usage

# ワンクリックセットアップ
./setup.sh
```

### Google Sheets連携

詳細は [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) を参照。

1. GCPプロジェクト作成 & Google Sheets API有効化
2. サービスアカウント作成 & JSONキーダウンロード
3. JSONキーを `credentials/service-account.json` に配置
4. スプレッドシート作成 & サービスアカウントと共有
5. `.env` にスプレッドシートIDを設定

```bash
cp .env.example .env
nano .env  # GOOGLE_SHEET_ID を設定
```

### 環境変数の反映

```bash
source ~/.zshrc
```

または新しいターミナルを開く。

## 使い方

### 動作確認

```bash
# Receiverの状態確認
curl http://localhost:4318/health

# 手動で集計実行（ドライラン）
uv run python -m src.aggregator --dry-run

# 実際にGoogle Sheetsにアップロード
uv run python -m src.aggregator
```

### 記録される統計

21列のデータが毎日記録されます：

- 基本: 日付、セッション数、アクティブ時間
- API: プロンプト数、APIコール数、コスト、トークン数
- コード: 追加/削除行数、コミット数、PR数
- ツール: ツール呼出数、成功率、TOP3
- パフォーマンス: エラー数、平均応答時間、モデル別コスト

### サービス管理

```bash
# サービスの状態確認
launchctl list | grep claude-usage

# Receiverを再起動
launchctl unload ~/Library/LaunchAgents/com.claude-usage.receiver.plist
launchctl load ~/Library/LaunchAgents/com.claude-usage.receiver.plist

# ログ確認
tail -f logs/receiver.stdout.log
tail -f logs/aggregator.log
```

## ディレクトリ構造

```
claude_usage/
├── pyproject.toml              # 依存関係
├── .env.example                # 環境変数テンプレート
├── .gitignore
├── setup.sh                    # セットアップスクリプト
├── README.md
├── GOOGLE_SHEETS_SETUP.md      # Sheets連携ガイド
├── src/
│   ├── receiver.py             # OTLP受信サーバー
│   ├── aggregator.py           # 日次集計
│   └── sheets.py               # Google Sheets連携
├── config/
│   ├── com.claude-usage.receiver.plist    # Receiver常駐設定
│   └── com.claude-usage.daily.plist       # 日次集計設定
├── data/                       # JSONLファイル (gitignore)
├── logs/                       # ログファイル (gitignore)
└── credentials/                # GCP認証情報 (gitignore)
```

## トラブルシューティング

### Receiverが起動しない

```bash
# ログを確認
cat logs/receiver.stderr.log

# 手動起動でテスト
uv run uvicorn src.receiver:app --host 127.0.0.1 --port 4318
```

### データが記録されない

1. 環境変数が設定されているか確認:
   ```bash
   echo $CLAUDE_CODE_ENABLE_TELEMETRY
   echo $OTEL_EXPORTER_OTLP_ENDPOINT
   ```

2. 新しいターミナルでClaude Codeを起動

### Google Sheetsにアップロードできない

1. サービスアカウントがスプレッドシートに共有されているか確認
2. `.env` の `GOOGLE_SHEET_ID` が正しいか確認
3. 認証情報を確認:
   ```bash
   uv run python -c "import json; print(json.load(open('credentials/service-account.json'))['client_email'])"
   ```

## ライセンス

MIT
