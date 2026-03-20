# LeadReport

HubSpot フォーム送信のトラフィックソース別リード集計アプリ

## 機能

- 指定期間に対象フォームから送信された**新規コンタクト**をオリジナルトラフィックソースごとに集計
- 各ソースの**商談移行率**と**顧客移行率**を表示
- トラフィックソースをクリックするとドリルダウン（キャンペーン名・参照元ドメイン等）で展開

### 対象フォーム

- 新規お問い合わせフォーム
- お試し加工フォーム
- レンタルフォーム
- オンラインデモフォーム
- 製品体験フォーム

## 技術スタック

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- HubSpot API

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、HubSpot のアクセストークンを設定します。

```bash
cp .env.local.example .env.local
```

```
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### HubSpot プライベートアプリの作成

1. HubSpot にログイン → 設定（歯車アイコン）
2. 連携 → プライベートアプリ → 「プライベートアプリを作成」
3. スコープタブで以下を有効化:
   - `crm.objects.contacts.read`
   - `forms`
4. 「アプリを作成」→ 表示されるアクセストークンをコピー

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

## 使い方

1. 開始日と終了日を選択
2. 「集計する」をクリック
3. トラフィックソース別の集計テーブルが表示される
4. 各行をクリックするとドリルダウンの内訳が展開される

## ライフサイクルステージの判定

| 指標 | 判定条件 |
|------|----------|
| 商談移行 | lifecyclestage が opportunity / customer / evangelist |
| 顧客移行 | lifecyclestage が customer / evangelist |
