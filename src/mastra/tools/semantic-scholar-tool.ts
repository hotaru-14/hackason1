import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract: string;
  authors: Array<{
    authorId: string;
    name: string;
  }>;
  year: number;
  citationCount: number;
  venue: string;
  publicationTypes: string[];
  url: string;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  fieldsOfStudy: string[];
}

// const semanticScholarPaperSchema = z.object({
//   paperId: z.string(),
//   title: z.string(),
//   abstract: z.string().nullable(),
//   authors: z.array(z.object({
//     authorId: z.string().nullable(),
//     name: z.string(),
//   })),
//   year: z.number().nullable(),
//   citationCount: z.number(),
//   venue: z.string().nullable(),
//   publicationTypes: z.array(z.string()),
//   url: z.string(),
//   openAccessPdf: z.object({
//     url: z.string(),
//     status: z.string(),
//   }).nullable(),
//   fieldsOfStudy: z.array(z.string()),
// });

// 簡略化された論文スキーマ（現在の返り値用）
const simplifiedPaperSchema = z.object({
  title: z.string(),
  abstract: z.string().nullable(),
  year: z.number().nullable(),
  citationCount: z.number(),
});

// URL収集データを取得する関数をエクスポート
export const getCollectedUrls = () => collectedUrls;
export const clearCollectedUrls = () => { collectedUrls = []; };

export const semanticScholarTool = createTool({
  id: 'search-semantic-scholar',
  description: 'Search for research papers using Semantic Scholar API',
  inputSchema: z.object({
    query: z.string().describe('Search query for papers'),
    maxResults: z.number().min(1).max(100).default(50).describe('Maximum number of results to return'),
  }),
  outputSchema: z.object({
    papers: z.array(simplifiedPaperSchema),
    // totalResults: z.number(),
    // query: z.string(),
  }),
  execute: async ({ context }) => {
    return await searchSemanticScholar(context.query, context.maxResults);
  },
});

// Rate limiting: 1 request per second for authenticated users
let lastSemanticScholarCall = 0;
const SEMANTIC_SCHOLAR_COOLDOWN_MS = 1000; // 1 second


// URL収集用のグローバルストレージ
let collectedUrls: Array<{id: string, title: string, url: string, source: string}> = [];

const searchSemanticScholar = async (
  query: string,
  maxResults: number = 50
) => {
  console.log(`\n🔍 [Semantic Scholar Tool] 検索を開始`);
  console.log(`📝 [Semantic Scholar Tool] クエリ: "${query}"`);
  console.log(`📊 [Semantic Scholar Tool] 取得件数: ${maxResults}件`);
  
  // Check cooldown
  const now = Date.now();
  const timeSinceLastCall = now - lastSemanticScholarCall;
  
  if (timeSinceLastCall < SEMANTIC_SCHOLAR_COOLDOWN_MS) {
    const waitTime = SEMANTIC_SCHOLAR_COOLDOWN_MS - timeSinceLastCall;
    console.log(`⏳ [Semantic Scholar Tool] レート制限のため${waitTime}ms待機中...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  const baseUrl = 'https://api.semanticscholar.org/graph/v1/paper/search';
  
  // Build query parameters
  const params = new URLSearchParams({
    query: query,
    limit: Math.min(maxResults, 50).toString(),
    fields: 'paperId,title,abstract,authors,year,citationCount,venue,publicationTypes,url,openAccessPdf,fieldsOfStudy',
  });

  const url = `${baseUrl}?${params.toString()}`;
  console.log(`🌐 [Semantic Scholar Tool] API リクエスト実行中...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Paper-Agent/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ [Semantic Scholar Tool] API エラー: ${response.status} ${response.statusText}`);
      if (response.status === 429) {
        throw new Error('Semantic Scholar API rate limit exceeded. Please try again later.');
      }
      throw new Error(`Semantic Scholar API request failed: ${response.status} ${response.statusText}`);
    }

    // Update last call time on successful request
    lastSemanticScholarCall = Date.now();
    console.log(`✅ [Semantic Scholar Tool] API リクエスト成功`);

    const data = await response.json();
    console.log(`📄 [Semantic Scholar Tool] ${data.data?.length || 0}件の論文を取得`);
    console.log(`📊 [Semantic Scholar Tool] 合計結果数: ${data.total || 'N/A'}`);
    
    const papers = (data.data || []).map((paper: any) => {
      const paperData = {
        paperId: paper.paperId || '',
        title: paper.title || '',
        abstract: paper.abstract || '',
        authors: (paper.authors || []).map((author: any) => ({
          authorId: author.authorId,
          name: author.name || 'Unknown Author',
        })),
        year: paper.year,
        citationCount: paper.citationCount || 0,
        venue: paper.venue || '',
        publicationTypes: paper.publicationTypes || [],
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        openAccessPdf: paper.openAccessPdf,
        fieldsOfStudy: paper.fieldsOfStudy || [],
      };

      // URL情報をサイドバー用に収集（エージェントには送らない）
      collectedUrls.push({
        id: paperData.paperId,
        title: paperData.title,
        url: paperData.url,
        source: 'Semantic Scholar'
      });

      // エージェントには簡略化データのみ返す
      return {
        title: paperData.title,
        abstract: paperData.abstract,
        year: paperData.year,
        citationCount: paperData.citationCount,
      };
    });

    console.log(`✨ [Semantic Scholar Tool] 検索完了: ${papers.length}件の論文データを処理`);
    
    // 論文のタイトルを簡潔にログ出力
    papers.forEach((paper: any, index: number) => {
      console.log(`  📖 [Semantic Scholar Tool] 論文${index + 1}: ${paper.title.slice(0, 60)}${paper.title.length > 60 ? '...' : ''}`);
    });

    return {
      papers,
      // totalResults: data.total || papers.length,
      // query,
    };

  } catch (error) {
    console.error(`❌ [Semantic Scholar Tool] 検索エラー:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to search Semantic Scholar: ${error.message}`);
    }
    throw new Error('Failed to search Semantic Scholar: Unknown error');
  }
};