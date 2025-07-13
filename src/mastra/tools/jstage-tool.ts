import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface JstagePaper {
  title: string;
  authors: string[];
  abstract: string;
  doi: string;
  journalTitle: string;
  volume: string;
  issueNumber: string;
  publicationDate: string;
  url: string;
  keywords: string[];
}

// J-STAGE論文スキーマ
// const jstagePaperSchema = z.object({
//   title: z.string(),
//   authors: z.array(z.string()),
//   abstract: z.string(),
//   doi: z.string(),
//   journalTitle: z.string(),
//   volume: z.string(),
//   issueNumber: z.string(),
//   publicationDate: z.string(),
//   url: z.string(),
//   keywords: z.array(z.string()),
// });

// 最低限の論文スキーマ
const simplifiedPaperSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()).max(3), // 最初の3名のみ
  publicationDate: z.string(),
  doi: z.string().nullable(),
  journalTitle: z.string().nullable(),
});

// URL収集データを取得する関数をエクスポート
export const getCollectedJstageUrls = () => collectedJstageUrls;
export const clearCollectedJstageUrls = () => { collectedJstageUrls = []; };

export const jstageTool = createTool({
  id: 'search-jstage',
  description: 'J-STAGE WebAPIを使用して日本の学術論文を検索し、論文へのアクセスリンク（URL、DOI）も含めて返します',
  inputSchema: z.object({
    query: z.string().describe('論文検索クエリ'),
    maxResults: z.number().min(1).max(100).default(10).describe('取得する論文の最大数'),
    material: z.string().optional().describe('資料区分 (原著論文など)'),
    pubyearfrom: z.string().optional().describe('出版年開始 (YYYY形式)'),
    pubyearto: z.string().optional().describe('出版年終了 (YYYY形式)'),
  }),
  outputSchema: z.object({
    papers: z.array(simplifiedPaperSchema),
    totalResults: z.number(),
  }),
  execute: async ({ context }) => {
    return await searchJstage(
      context.query, 
      context.maxResults, 
      context.material,
      context.pubyearfrom,
      context.pubyearto
    );
  },
});

// レート制限対応: 1秒に1リクエスト
let lastJstageCall = 0;
const JSTAGE_COOLDOWN_MS = 1000; // 1秒

// URL収集用のグローバルストレージ
let collectedJstageUrls: Array<{id: string, title: string, url: string, source: string}> = [];

const searchJstage = async (
  query: string,
  maxResults: number = 10,
  material?: string,
  pubyearfrom?: string,
  pubyearto?: string
) => {
  console.log(`\n🔍 [J-STAGE Tool] 検索を開始`);
  console.log(`📝 [J-STAGE Tool] クエリ: "${query}"`);
  console.log(`📊 [J-STAGE Tool] 取得件数: ${maxResults}件`);
  if (material) console.log(`📋 [J-STAGE Tool] 資料区分: ${material}`);
  if (pubyearfrom || pubyearto) {
    console.log(`📅 [J-STAGE Tool] 出版年: ${pubyearfrom || '?'} - ${pubyearto || '?'}`);
  }

  // レート制限チェック
  const now = Date.now();
  const timeSinceLastCall = now - lastJstageCall;
  
  if (timeSinceLastCall < JSTAGE_COOLDOWN_MS) {
    const waitTime = JSTAGE_COOLDOWN_MS - timeSinceLastCall;
    console.log(`⏳ [J-STAGE Tool] レート制限のため${waitTime}ms待機中...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  const baseUrl = 'https://api.jstage.jst.go.jp/searchapi/do';
  
  // クエリパラメータ構築
  const params = new URLSearchParams({
    service: '3', // 論文検索サービス
    text: query,
    start: '1',
    count: Math.min(maxResults, 100).toString(),
  });

  // オプションパラメータ追加
  if (material) {
    params.append('material', material);
  }
  if (pubyearfrom) {
    params.append('pubyearfrom', pubyearfrom);
  }
  if (pubyearto) {
    params.append('pubyearto', pubyearto);
  }

  const url = `${baseUrl}?${params.toString()}`;
  console.log(`🌐 [J-STAGE Tool] API リクエスト実行中...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Paper-Agent/1.0',
        'Accept': 'application/xml, text/xml',
      },
    });

    if (!response.ok) {
      console.error(`❌ [J-STAGE Tool] API エラー: ${response.status} ${response.statusText}`);
      throw new Error(`J-STAGE API request failed: ${response.status} ${response.statusText}`);
    }

    // レスポンス成功時の記録
    lastJstageCall = Date.now();
    console.log(`✅ [J-STAGE Tool] API リクエスト成功`);

    const xmlText = await response.text();
    console.log(`📄 [J-STAGE Tool] XMLレスポンス取得: ${xmlText.length}文字`);

    // XMLパース（デバッグ情報付き）
    console.log(`🔍 [J-STAGE Tool] XMLパース開始...`);
    console.log(`📄 [J-STAGE Tool] XMLサンプル（最初500文字）: ${xmlText.substring(0, 500)}`);
    
    const papers = parseJstageXML(xmlText);
    const totalHits = extractTotalHits(xmlText);

    console.log(`📊 [J-STAGE Tool] 総ヒット数: ${totalHits}件`);
    console.log(`✨ [J-STAGE Tool] 検索完了: ${papers.length}件の論文データを処理`);
    console.log(`🔍 [J-STAGE Tool] パース成功率: ${papers.length}/${totalHits} (${totalHits > 0 ? Math.round(papers.length / totalHits * 100) : 0}%)`);
    
    // パースできた論文の詳細をログ出力
    if (papers.length > 0) {
      console.log(`📋 [J-STAGE Tool] 最初の論文詳細:`);
      console.log(`  タイトル: ${papers[0].title}`);
      console.log(`  抽象: ${papers[0].abstract.substring(0, 100)}...`);
      console.log(`  発表日: ${papers[0].publicationDate}`);
    } else {
      console.log(`❌ [J-STAGE Tool] 論文データが1件も抽出されませんでした`);
    }
    
    // 論文タイトルを簡潔にログ出力
    papers.forEach((paper, index) => {
      console.log(`  📖 [J-STAGE Tool] 論文${index + 1}: ${paper.title.slice(0, 50)}${paper.title.length > 50 ? '...' : ''}`);
    });

    // URL情報をサイドバー用に収集（エージェントには送らない）
    papers.forEach(paper => {
      collectedJstageUrls.push({
        id: paper.doi || `jstage-${Date.now()}-${Math.random()}`,
        title: paper.title,
        url: paper.url || `https://www.jstage.jst.go.jp/search/global/_search/-char/ja?item=${encodeURIComponent(paper.title)}`,
        source: 'J-STAGE'
      });
    });

    const simplifiedPapers = papers.map(paper => ({
      title: paper.title,
      authors: paper.authors.slice(0, 3), // 最初の3名のみ
      publicationDate: paper.publicationDate,
      doi: paper.doi || null,
      journalTitle: paper.journalTitle || null,
    }));

    return {
      papers: simplifiedPapers,
      totalResults: totalHits,
    };

  } catch (error) {
    console.error(`❌ [J-STAGE Tool] 検索エラー:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to search J-STAGE: ${error.message}`);
    }
    throw new Error('Failed to search J-STAGE: Unknown error');
  }
};

/**
 * J-STAGE XMLレスポンスをパース
 */
const parseJstageXML = (xmlText: string): JstagePaper[] => {
  const papers: JstagePaper[] = [];
  
  console.log(`🔍 [J-STAGE Tool] XMLパース関数開始`);
  
  try {
    // arXivスタイルのパース処理を試す
    let matchedElements = xmlText.match(/<entry[^>]*>[\s\S]*?<\/entry>/g) || [];
    console.log(`📄 [J-STAGE Tool] 見つかった<entry>要素数: ${matchedElements.length}`);
    
    if (matchedElements.length === 0) {
      // J-STAGEスタイルのパース
      matchedElements = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];
      console.log(`📄 [J-STAGE Tool] 見つかった<item>要素数: ${matchedElements.length}`);
    }
    
    if (matchedElements.length > 0 && matchedElements[0]) {
      console.log(`📋 [J-STAGE Tool] 最初の要素（最初300文字）: ${matchedElements[0].substring(0, 300)}`);
    } else {
      console.log(`❌ [J-STAGE Tool] 論文要素が見つかりません。XML構造を確認してください。`);
    }
    
         for (let i = 0; i < matchedElements.length; i++) {
       const itemXml = matchedElements[i];
      console.log(`📝 [J-STAGE Tool] 論文 ${i + 1} をパース中...`);
      
      try {
        const title = extractXmlTag(itemXml, 'title') || 'No Title';
        const abstract = extractXmlTag(itemXml, 'description') || '';
        const publicationDate = extractXmlTag(itemXml, 'prism:publicationDate') || '';
        
        console.log(`  タイトル: ${title.substring(0, 50)}...`);
        console.log(`  抽象: ${abstract.substring(0, 50)}...`);
        console.log(`  発表日: ${publicationDate}`);
        
        const paper: JstagePaper = {
          title,
          authors: extractAuthors(itemXml),
          abstract,
          doi: extractXmlTag(itemXml, 'prism:doi') || '',
          journalTitle: extractXmlTag(itemXml, 'prism:publicationName') || '',
          volume: extractXmlTag(itemXml, 'prism:volume') || '',
          issueNumber: extractXmlTag(itemXml, 'prism:number') || '',
          publicationDate,
          url: extractUrl(itemXml),
          keywords: extractKeywords(itemXml),
        };

        papers.push(paper);
        console.log(`✅ [J-STAGE Tool] 論文 ${i + 1} パース完了`);
      } catch (error) {
        console.warn(`⚠️ [J-STAGE Tool] 論文 ${i + 1} パースエラー:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error(`❌ [J-STAGE Tool] XMLパースエラー:`, error);
  }

  console.log(`🎯 [J-STAGE Tool] XMLパース完了: ${papers.length}件の論文を抽出`);
  return papers;
};

/**
 * XML内の総ヒット数を抽出
 */
const extractTotalHits = (xmlText: string): number => {
  const totalResultsMatch = xmlText.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  return totalResultsMatch ? parseInt(totalResultsMatch[1], 10) : 0;
};

/**
 * XMLタグの内容を抽出
 */
const extractXmlTag = (xml: string, tagName: string): string => {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'i');
  const match = xml.match(regex);
  const result = match ? match[1].trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : '';
  
  // デバッグ情報（主要なタグのみ）
  if (['title', 'description', 'prism:publicationDate'].includes(tagName)) {
    console.log(`  🔍 [J-STAGE Tool] タグ "${tagName}": ${result ? `"${result.substring(0, 50)}..."` : '見つからず'}`);
  }
  
  return result;
};

/**
 * URL情報を抽出（複数の方法を試行）
 */
const extractUrl = (xml: string): string => {
  // 1. link タグから抽出
  let url = extractXmlTag(xml, 'link');
  if (url) return url;
  
  // 2. guid タグから抽出
  url = extractXmlTag(xml, 'guid');
  if (url) return url;
  
  // 3. prism:url タグから抽出
  url = extractXmlTag(xml, 'prism:url');
  if (url) return url;
  
  // 4. DOIからURL生成
  const doi = extractXmlTag(xml, 'prism:doi');
  if (doi) {
    return `https://doi.org/${doi}`;
  }
  
  // 5. identifierからURL抽出
  const identifier = extractXmlTag(xml, 'prism:identifier') || extractXmlTag(xml, 'identifier');
  if (identifier && identifier.startsWith('http')) {
    return identifier;
  }
  
  return '';
};

/**
 * 著者情報を抽出
 */
const extractAuthors = (xml: string): string[] => {
  const authors: string[] = [];
  
  // dc:creator タグから著者を抽出
  const creatorMatches = xml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/g) || [];
  for (const match of creatorMatches) {
    const author = extractXmlTag(match, 'dc:creator');
    if (author && !authors.includes(author)) {
      authors.push(author);
    }
  }

  // prism:creatorName からも抽出
  const creatorNameMatches = xml.match(/<prism:creatorName[^>]*>([^<]+)<\/prism:creatorName>/g) || [];
  for (const match of creatorNameMatches) {
    const author = extractXmlTag(match, 'prism:creatorName');
    if (author && !authors.includes(author)) {
      authors.push(author);
    }
  }

  return authors;
};

/**
 * キーワードを抽出
 */
const extractKeywords = (xml: string): string[] => {
  const keywords: string[] = [];
  
  // prism:keyword タグからキーワードを抽出
  const keywordMatches = xml.match(/<prism:keyword[^>]*>([^<]+)<\/prism:keyword>/g) || [];
  for (const match of keywordMatches) {
    const keyword = extractXmlTag(match, 'prism:keyword');
    if (keyword && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  return keywords;
};