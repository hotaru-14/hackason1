# Paper Agent

学術論文検索特化型リサーチエージェント - 複数の学術データベースを駆使して徹底的な論文検索を実行し、研究動向を分析します。

## 特徴

- **多角的論文検索**: arXiv、Semantic Scholar、CORE、J-STAGE、Brave Searchを統合
- **日本語対応**: 日本の学術動向も含めた包括的な研究分析
- **リアルタイム検索**: ストリーミング対応でライブ検索結果表示
- **Mastraフレームワーク**: AIエージェント、ワークフロー、ツールの統合プラットフォーム

## 技術スタック

- **フロントエンド**: Next.js 15, TypeScript, Tailwind CSS
- **AIフレームワーク**: Mastra (Google Gemini 2.5 Flash)
- **データベース**: LibSQL
- **デプロイ**: Vercel

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint
```

## 環境変数

```bash
# API キー (必要に応じて)
GOOGLE_API_KEY=your-gemini-api-key
CORE_API_KEY=your-core-api-key
BRAVE_API_KEY=your-brave-api-key
```

## 主要コンポーネント

- `src/mastra/agents/deep-paper-agent.ts` - メインの論文検索エージェント
- `src/mastra/tools/` - 各種検索ツール (arXiv, Semantic Scholar等)
- `src/components/DeepPaperChat.tsx` - チャットUI
- `src/app/api/agents/deep-paper/` - エージェントAPI

## デプロイ

```bash
# Vercelにデプロイ
vercel deploy
```

アプリケーションは [http://localhost:3000](http://localhost:3000) でアクセスできます。