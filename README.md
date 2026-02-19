# 一正 - HISEI

## 公開URL（Vercel）
https://hisei.vercel.app/

## 開発期間
2026.02.11 ~ 2026.02.18（制作時間 約50時間）

## 概要
`一正 - HISEI` は、5x5盤面で戦うオリジナル対戦ゲームです。  
通常対戦・CPU対戦・フレンド機能・季譜保存・アチーブメント・称号/フレーム収集まで、
「対局の熱」と「育成の継続性」を1つにまとめました。

## こだわりポイント
- 独自ルールを実装した5x5対局ロジック（通常対戦 / CPU対戦）
- 1手戻し・勝敗判定・季譜（手順）表示まで一貫して実装
- Supabase連携によるログイン、プロフィール、フレンド、保存季譜
- アチーブメント達成で称号開放、プロフィールに装備可能
- 季石を使ったガチャと倉庫管理で、見た目カスタムのモチベーションを設計

## 主な機能
- 対局: ホットシート対戦、CPU対戦（難易度と記録連動）
- 学習: ルール説明、体験チュートリアル
- 成長: ランク、季石、アチーブメント、プレゼントボックス
- コミュニティ: フレンド申請/承諾、フレンドプロフィール閲覧
- 記録: 季譜保存、履歴閲覧、プロフィール掲載設定

## スクリーンショット（5枚以上）
> 必要条件に合わせて、主要画面を掲載しています。

### 1. ホーム
![ホーム画面](https://image.thum.io/get/width/1400/noanimate/https://hisei.vercel.app/)

### 2. 通常対戦
![通常対戦画面](https://image.thum.io/get/width/1400/noanimate/https://hisei.vercel.app/play)

### 3. CPU対戦
![CPU対戦画面](https://image.thum.io/get/width/1400/noanimate/https://hisei.vercel.app/cpu)

### 4. プロフィール
![プロフィール画面](https://image.thum.io/get/width/1400/noanimate/https://hisei.vercel.app/profile)

### 5. フレンド
![フレンド画面](https://image.thum.io/get/width/1400/noanimate/https://hisei.vercel.app/friends)

### 6. アチーブメント
![アチーブメント画面](https://image.thum.io/get/width/1400/noanimate/https://hisei.vercel.app/achievements)

## 技術スタック
- Frontend: Next.js 16 (App Router), React 19, TypeScript
- Backend / BaaS: Supabase
- Styling: CSS (App Router構成)
- Deploy: Vercel

## セットアップ
```bash
npm install
npm run dev
```

## 提出時メモ
- Teams「PG3-課題3」に提出するのは **Vercel URLではなくGitHubリポジトリURL**
- 本README先頭付近に Vercel URL と開発期間を明記済み

## 今後実装予定（ロードマップ）
- オンライン対戦機能
  - リアルタイムマッチング、対局ルーム、観戦対応
- シーズンイベント更新
  - 期間限定アチーブメント、限定称号・フレーム、イベント報酬
- ランク戦 / レート機能
  - 勝敗によるレート増減、段位帯ごとの報酬設計
- フレンド周辺の拡張
  - フレンド招待リンク、対戦申請、簡易チャット / スタンプ
- ガチャ・倉庫の拡張
  - ピックアップ更新、天井システム、アイテム一括管理UI
- リプレイ機能の強化
  - 共有リンク、コメント付き保存、ハイライト生成
- 運営向け機能
  - お知らせ配信、イベント設定、ユーザー分析ダッシュボード

---
熱中して遊べて、記録したくなる。  
`一正 - HISEI` はその体験を目指して制作しました。
