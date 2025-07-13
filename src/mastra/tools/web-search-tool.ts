// ================================================================
// トップカンファレンス特化 Web Search Tool
// ------------------------------------------------
// ICML、NeurIPS、ICLR、AAAI等のトップカンファレンスに特化した
// 検索ツール。論文データベースAPIのレートリミット時の代替手段として
// 10件の検索結果とアブストラクトを効率的に取得します。
// ================================================================

// ------------------------------
// 依存ライブラリのインポート
// ------------------------------
import { createTool } from "@mastra/core/tools"; // Mastra フレームワーク: ツール作成ヘルパ
import { z } from "zod";                         // スキーマバリデーション用ライブラリ
import { GoogleGenAI } from '@google/genai';      // Google Generative AI SDK (Gemini)

/* ---------------------------------------------------------------
 * 1. 現在の日時を "YYYY年MM月DD日 (曜日) HH:MM" 形式で取得するヘルパ
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
 * 2. Gemini Search API クライアントのシングルトン生成
 * ------------------------------------------------------------- */
let genai: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not found. Please set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable.");
    }
    genai = new GoogleGenAI({ apiKey });
  }
  return genai;
}

/* ---------------------------------------------------------------
 * 3. トップカンファレンス特化検索を実行する関数
 * ------------------------------------------------------------- */
const searchTopConferences = async (query: string): Promise<{
  content: string;
  citations: string[];
  papers: Array<{
    title: string;
    authors: string;
    conference: string;
    year: string;
    abstract: string;
    url: string;
  }>;
}> => {
  try {
    console.log(`[Conference Search] トップカンファレンス検索を開始: "${query}"`);
    
    const genaiClient = getGenAIClient();
    const currentDateTime = getCurrentDateTime();
    
    // トップカンファレンス特化プロンプト
    const prompt = `次のトピックについて、機械学習・AI分野のトップカンファレンスから最新の研究論文を検索してください: ${query}

現在の日時: ${currentDateTime}

**検索対象のトップカンファレンス（優先順位順）:**
1. **ICML** (International Conference on Machine Learning) - icml.cc
2. **NeurIPS** (Neural Information Processing Systems) - neurips.cc  
3. **ICLR** (International Conference on Learning Representations) - iclr.cc
4. **AAAI** (Association for the Advancement of Artificial Intelligence) - aaai.org
5. **IJCAI** (International Joint Conference on Artificial Intelligence) - ijcai.org
6. **ACL** (Association for Computational Linguistics) - aclweb.org
7. **CVPR** (Computer Vision and Pattern Recognition) - cvpr.org
8. **ICCV** (International Conference on Computer Vision) - iccv.org
9. **ECCV** (European Conference on Computer Vision) - eccv.org
10. **SIGIR** (Special Interest Group on Information Retrieval) - sigir.org

**重要な制約:**
- **最大10件の論文**のみを選定してください
- 各論文について以下の情報を必ず含めてください：
  * 論文タイトル

  * カンファレンス名と開催年
  * アブストラクト（要約）
  * 論文URL（利用可能な場合）

**出力形式:**
以下の構造化されたマークダウン形式で回答してください：

## 🏆 トップカンファレンス検索結果: ${query}

### 📊 検索サマリー
- 検索対象カンファレンス: [実際に検索したカンファレンス]
- 発見論文数: [X件]
- 対象年度: [YYYY-YYYY]

### 📑 論文リスト（重要度順）

#### 1. [論文タイトル]
- **著者**: [著者名]
- **カンファレンス**: [カンファレンス名 年度]
- **アブストラクト**: [論文の要約・主な貢献]
- **URL**: [論文リンク]

#### 2. [論文タイトル]
...（最大10件まで）

### 🎯 主要トレンド
[発見された主要な研究トレンドや手法]

### 🔗 カンファレンス情報
[各カンファレンスの最新開催情報]

一般的なウェブサイトやニュースサイトではなく、必ずトップカンファレンスの公式サイトや論文情報に焦点を当ててください。`;

    const response = await genaiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [ { googleSearch: {} } ],
        temperature: 0.7,  // カンファレンス検索では少し決定論的に
        maxOutputTokens: 8192,  // アブストラクト込みなので適度な長さに制限
      },
    });

    const text = response.text || '';
    
    // Grounding メタデータから引用 URL を抽出
    const citations: string[] = [];
    const papers: Array<{
      title: string;
      authors: string;
      conference: string;
      year: string;
      abstract: string;
      url: string;
    }> = [];

    try {
      if ((response as any).candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const chunks = (response as any).candidates[0].groundingMetadata.groundingChunks;
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri) {
            citations.push(chunk.web.uri);
          }
        });
      }
    } catch (error) {
      console.log(`[Conference Search] メタデータ抽出エラー:`, error);
    }

    // レスポンステキストから論文情報を構造化（簡易的な抽出）
    const paperMatches = text.match(/#### \d+\.\s*([\s\S]*?)(?=#### \d+\.|### 🎯|$)/g);
    if (paperMatches) {
      paperMatches.slice(0, 10).forEach(match => {
        const titleMatch = match.match(/#### \d+\.\s*(.+)/);
        const authorsMatch = match.match(/\*\*著者\*\*:\s*(.+)/);
        const conferenceMatch = match.match(/\*\*カンファレンス\*\*:\s*(.+)/);
        const abstractMatch = match.match(/\*\*アブストラクト\*\*:\s*(.+)/);
        const urlMatch = match.match(/\*\*URL\*\*:\s*(.+)/);

        if (titleMatch) {
          papers.push({
            title: titleMatch[1].trim(),
            authors: authorsMatch?.[1]?.trim() || '',
            conference: conferenceMatch?.[1]?.trim() || '',
            year: conferenceMatch?.[1]?.match(/\d{4}/)?.[0] || '',
            abstract: abstractMatch?.[1]?.trim() || '',
            url: urlMatch?.[1]?.trim() || '',
          });
        }
      });
    }

    console.log(`[Conference Search] 検索完了: ${papers.length}件の論文を発見`);
    
    // 引用リストを追加
    let result = text;
    if (citations.length > 0) {
      const uniqueSources = Array.from(new Set(citations));
      result += '\n\n**🔗 参考カンファレンスサイト:**\n' + uniqueSources.map((source, i) => `[${i + 1}] ${source}`).join('\n');
    }
    
    return { content: result, citations, papers };
  } catch (error) {
    console.error(`[Conference Search] エラー:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: `申し訳ありません。トップカンファレンス検索中にエラーが発生しました: ${errorMessage}`,
      citations: [],
      papers: []
    };
  }
};

/* ---------------------------------------------------------------
 * 4. Mastra ツール定義 (createTool)
 * ------------------------------------------------------------- */
export const googleGroundingSearchTool = createTool({
  id: "top-conference-search",
  description: "ICML、NeurIPS、ICLR等のトップカンファレンスから最新研究論文を検索し、最大10件の論文とアブストラクトを取得。論文データベースAPIのレートリミット時の代替手段として活用",
  
  inputSchema: z.object({
    query: z.string().describe("研究トピック検索クエリ（例：'transformer architecture', 'reinforcement learning', 'computer vision'）"),
    searchId: z.number().default(0).describe("検索ID（並列検索用）"),
  }),
  
  outputSchema: z.object({
    searchId: z.number(),
    query: z.string(),
    content: z.string(),  // フォーマット済みマークダウン
    citations: z.array(z.string()),  // カンファレンスサイトURL
    papers: z.array(z.object({  // 構造化された論文情報
      title: z.string(),
      authors: z.string(),
      conference: z.string(),
      year: z.string(),
      abstract: z.string(),
      url: z.string(),
    })),
    success: z.boolean(),
    error: z.string().optional(),
  }),

  execute: async ({ context }) => {
    const { query, searchId } = context;
    
    try {
      console.log(`[Conference Search ${searchId}] トップカンファレンス検索開始: "${query}"`);
      
      const { content, citations, papers } = await searchTopConferences(query);
      
      console.log(`[Conference Search ${searchId}] 検索完了: ${papers.length}件の論文、${citations.length}個のソース`);
      
      return {
        searchId,
        query,
        content,
        citations,
        papers,
        success: true,
      };
      
    } catch (error: any) {
      console.error(`[Conference Search ${searchId}] エラー:`, error);
      return {
        searchId,
        query,
        content: `トップカンファレンス検索エラー: "${query}"の検索中に問題が発生しました。`,
        citations: [],
        papers: [],
        success: false,
        error: error.message,
      };
    }
  },
});

// 後方互換性のため、元の名前でもエクスポート
export const webSearchTool = googleGroundingSearchTool;
