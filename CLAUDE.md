# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

HubSpotフォーム送信のトラフィックソース別リード集計アプリ。指定期間に5種のフォーム（新規お問い合わせ、お試し加工、レンタル、オンラインデモ、製品体験）から送信された新規コンタクトを、オリジナルトラフィックソースごとに集計し、商談移行率・顧客移行率を表示する。

## コマンド

```bash
npm run dev    # 開発サーバー起動 (localhost:3000)
npm run build  # 本番ビルド
npm start      # 本番サーバー起動
```

## 環境変数

- `HUBSPOT_ACCESS_TOKEN` — HubSpotプライベートアプリのアクセストークン。必要なスコープ: `crm.objects.contacts.read`, `forms`
- `AUTH_PASSWORD` — アプリへのアクセスパスワード

`.env.local` に設定。`.env.local.example` を参照。

## デプロイ

Vercel にデプロイ済み。`main` ブランチへのプッシュで自動デプロイ。環境変数は Vercel の Project Settings > Environment Variables で管理。

## アーキテクチャ

Next.js 15 App Router + TypeScript + Tailwind CSS 4。

### 認証

- `src/middleware.ts` で全ページをパスワード保護（`/login` と `/api/auth` は除外）
- `src/app/login/page.tsx` でログイン画面を表示
- `src/app/api/auth/route.ts` でパスワード検証、認証cookieを発行（30日間有効）

### データフロー

```
フロントエンド (page.tsx) → GET /api/report?startDate=&endDate=
  → route.ts → hubspot.ts の generateReport()
    1. getTargetForms(): HubSpot Forms API で5対象フォームのGUID取得
    2. getFormSubmissions(): 各フォームの送信からメールアドレス抽出（並列実行）
    3. batchGetContacts(): メールアドレスでコンタクト一括取得（100件単位）
    4. 集計: hs_analytics_source別にグルーピング、hs_analytics_source_data_1でドリルダウン
  → JSON レスポンス → フロントエンドでテーブル表示（行クリックで展開）
```

### ビジネスロジック

- **新規コンタクト判定**: `createdate`が指定期間内
- **商談移行**: `lifecyclestage`が opportunity / customer / evangelist
- **顧客移行**: `lifecyclestage`が customer / evangelist
- **レート計算**: 小数点1桁（×1000→÷10でround）

### HubSpot API エンドポイント

- フォーム一覧: `GET /marketing/v3/forms`
- フォーム送信: `GET /form-integrations/v1/submissions/forms/{formGuid}`（新しい順、50件ずつページネーション）
- コンタクト一括取得: `POST /crm/v3/objects/contacts/batch/read`（`idProperty: "email"`で検索）
