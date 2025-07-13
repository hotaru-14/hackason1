// ================================================================
// Brave Search API Web Search Tool
// ------------------------------------------------
// このファイルでは、Brave Search APIを利用してリアルタイム検索を行い、
// その結果をMastraのツールとして利用できるようにラップしています。
// Brave Searchは独立した検索エンジンで、高品質なデータを提供します。
// ================================================================

// ------------------------------
// 依存ライブラリのインポート
// ------------------------------
import { createTool } from "@mastra/core/tools"; // Mastra フレームワーク: ツール作成ヘルパ
import { z } from "zod";                         // スキーマバリデーション用ライブラリ

/* ---------------------------------------------------------------
 * 1. Brave Search API のレスポンス型定義
 * ------------------------------------------------------------- */
interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  display_url: string;
  age?: string;
  language?: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
    total_count?: number;
  };
  query: {
    original: string;
    show_strict_warning: boolean;
    altered?: string;
  };
}

/* ---------------------------------------------------------------
 * 2. 現在の日時を取得するヘルパ
 * ------------------------------------------------------------- */
const getCurrentDateTime = (): string => {
  return new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/* ---------------------------------------------------------------
 * 3. Brave Search API を呼び出してweb検索を実行する関数
 * ------------------------------------------------------------- */
const searchWithBraveAPI = async (query: string): Promise<{
  results: BraveSearchResult[];
  totalResults?: number;
  query: string;
}> => {
  try {
    console.log(`[Brave Search] Starting search for: "${query}"`);
    
    // 環境変数からAPIキーを取得
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error("Brave Search API key not found. Please set BRAVE_SEARCH_API_KEY environment variable.");
    }
    
    // APIエンドポイントとパラメータの設定
    const baseUrl = 'https://api.search.brave.com/res/v1/web/search';
    const params = new URLSearchParams({
      q: query,
      count: '10',           // 結果数（最大20）
      offset: '0',           // オフセット
      country: 'JP',         // 国コード（日本）
      search_lang: 'jp',     // 検索言語（修正: 'ja' → 'jp'）
      ui_lang: 'ja-JP',      // UI言語（修正: 'ja' → 'ja-JP'）
      freshness: 'pd',       // 新しさ（pd=過去1日、pw=過去1週間、pm=過去1ヶ月、py=過去1年）
      text_decorations: 'true', // テキスト装飾を有効化
      spellcheck: 'true',    // スペルチェックを有効化
    });
    
    // HTTP リクエストの実行
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brave Search API error: ${response.status} - ${errorText}`);
    }
    
    const data: BraveSearchResponse = await response.json();
    console.log(`[Brave Search] Search completed successfully for: "${query}"`);
    
    // 結果の整形
    const results = data.web?.results || [];
    const totalResults = data.web?.total_count;
    
    console.log(`[Brave Search] Found ${results.length} results (total: ${totalResults || 'unknown'})`);
    
    return {
      results,
      totalResults,
      query: data.query.original,
    };
    
  } catch (error) {
    console.error(`[Brave Search] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Brave Search API error: ${errorMessage}`);
  }
};

// outputスキーマ
const outputSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    description: z.string(),
  })).max(5), // 最大5件の結果のみ
  searchQuery: z.string(),
  timestamp: z.string(),
});

export const braveSearchTool = createTool({
  id: 'brave-search-web',
  description: 'リアルタイムのweb検索を実行し、研究分野の最新動向や概観を把握する',
  inputSchema: z.object({
    query: z.string().describe('検索クエリ'),
    maxResults: z.number().min(1).max(5).default(5).describe('取得する検索結果の最大数'),
  }),
  outputSchema,

  /*
   * 4-3. execute: ツールの実行ロジック
   */
  execute: async ({ context }) => {
    const { query, maxResults } = context;
    const searchTime = getCurrentDateTime();
    
    try {
      console.log(`[Brave Search] Starting web search for: "${query}"`);
      
      // Brave Search API での検索実行
      const { results, query: actualQuery } = await searchWithBraveAPI(query);
      
      // 結果を出力スキーマに合わせて整形（最大5件）
      const formattedResults = results.slice(0, maxResults).map(result => ({
        title: result.title,
        url: result.url,
        description: result.description,
      }));
      
      console.log(`[Brave Search] Search completed successfully, found ${formattedResults.length} results`);
      
      return {
        results: formattedResults,
        searchQuery: actualQuery,
        timestamp: searchTime,
      };
      
    } catch (error: any) {
      console.error(`[Brave Search] Error:`, error);
      return {
        results: [],
        searchQuery: query,
        timestamp: searchTime,
      };
    }
  },
}); 