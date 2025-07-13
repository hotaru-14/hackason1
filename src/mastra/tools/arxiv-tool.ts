import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface ArxivEntry {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  published: string;
  updated: string;
  link: string;
}

// const paperSchema = z.object({
//   id: z.string(),
//   title: z.string(),
//   authors: z.array(z.string()),
//   abstract: z.string(),
//   categories: z.array(z.string()),
//   published: z.string(),
//   updated: z.string(),
//   link: z.string(),
// });

// 簡略化された論文スキーマ（PDFリンク付き）
const simplifiedPaperSchema = z.object({
  title: z.string(),
  abstract: z.string(),
  published: z.string(),
  pdfLink: z.string().describe('Direct link to PDF file'),
  arxivId: z.string().describe('arXiv ID (e.g., "2301.12345")'),
});

// URL収集データを取得する関数をエクスポート
export const getCollectedArxivUrls = () => collectedArxivUrls;
export const clearCollectedArxivUrls = () => { collectedArxivUrls = []; };

export const arxivTool = createTool({
  id: 'search-arxiv',
  description: 'Search for research papers on arXiv',
  inputSchema: z.object({
    query: z.string().describe('Search query for papers (e.g., "machine learning", "au:Einstein", "ti:quantum")'),
    maxResults: z.number().min(1).max(100).default(1).describe('Maximum number of results to return'),
    sortBy: z.enum(['relevance', 'lastUpdatedDate', 'submittedDate']).default('relevance').describe('Sort order for results'),
  }),
  outputSchema: z.object({
    papers: z.array(simplifiedPaperSchema),
    // totalResults: z.number(),
    // query: z.string(),
  }),
  execute: async ({ context }) => {
    return await searchArxiv(context.query, context.maxResults, context.sortBy);
  },
});

// Cooldown mechanism to prevent API abuse
let lastArxivCall = 0;
const ARXIV_COOLDOWN_MS = 30000; // 30 seconds

// URL収集用のグローバルストレージ
let collectedArxivUrls: Array<{id: string, title: string, url: string, source: string}> = [];

const searchArxiv = async (query: string, maxResults: number = 1, sortBy: string = 'relevance') => {
  console.log(`[arXiv Tool] Starting search for: "${query}" (maxResults: ${maxResults}, sortBy: ${sortBy})`);
  
  // Check cooldown
  const now = Date.now();
  const timeSinceLastCall = now - lastArxivCall;
  
  if (timeSinceLastCall < ARXIV_COOLDOWN_MS) {
    const waitTime = ARXIV_COOLDOWN_MS - timeSinceLastCall;
    console.log(`[arXiv Tool] ⏳ Cooldown active. Need to wait ${Math.ceil(waitTime / 1000)} seconds`);
    throw new Error(`arXiv API cooldown active. Please wait ${Math.ceil(waitTime / 1000)} seconds before next search.`);
  }

  const baseUrl = 'http://export.arxiv.org/api/query';
  const params = new URLSearchParams({
    search_query: query,
    start: '0',
    max_results: maxResults.toString(),
    sortBy: sortBy,
    sortOrder: 'descending',
  });

  const url = `${baseUrl}?${params.toString()}`;
  console.log(`[arXiv Tool] 🚀 Making API request to: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[arXiv Tool] ❌ API request failed: ${response.status} ${response.statusText}`);
      throw new Error(`arXiv API request failed: ${response.status} ${response.statusText}`);
    }

    // Update last call time on successful request
    lastArxivCall = now;
    console.log(`[arXiv Tool] ✅ API request successful. Next request allowed after: ${new Date(now + ARXIV_COOLDOWN_MS).toLocaleTimeString()}`);

    const xmlText = await response.text();
    console.log(`[arXiv Tool] 📄 Received XML response: ${xmlText.length} characters`);
    
    const papers = parseArxivXML(xmlText);
    console.log(`[arXiv Tool] 📚 Parsed ${papers.length} papers from XML`);

    if (papers.length > 0) {
      console.log(`[arXiv Tool] 📖 First paper: "${papers[0].title}" by ${papers[0].authors.join(', ')}`);
    }

    // URL情報をサイドバー用に収集（エージェントには送らない）
    papers.forEach(paper => {
      collectedArxivUrls.push({
        id: paper.id,
        title: paper.title,
        url: paper.link,
        source: 'arXiv'
      });
    });

    const simplifiedPapers = papers.map(paper => {
      // arXiv XMLから抽出された実際のリンクを使用
      // linkはXMLから抽出されたPDFリンクまたは抽象ページリンク
      let pdfLink = paper.link;
      
      // リンクが抽象ページ（/abs/）の場合、PDFリンク（/pdf/）に変換
      if (pdfLink.includes('/abs/')) {
        pdfLink = pdfLink.replace('/abs/', '/pdf/');
      }
      
      // .pdf拡張子を確実に追加（一括ダウンロード用）
      if (!pdfLink.endsWith('.pdf')) {
        pdfLink += '.pdf';
      }
      
      return {
        title: paper.title,
        abstract: paper.abstract,
        published: paper.published,
        pdfLink: pdfLink,
        arxivId: paper.id,
      };
    });

    return {
      papers: simplifiedPapers,
      // totalResults: papers.length,
      // query,
    };
  } catch (error) {
    console.error(`[arXiv Tool] ❌ Search failed:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to search arXiv: ${error.message}`);
    }
    throw new Error('Failed to search arXiv: Unknown error');
  }
};

const parseArxivXML = (xmlText: string): ArxivEntry[] => {
  console.log(`[arXiv Tool] 🔍 Starting XML parsing...`);
  const papers: ArxivEntry[] = [];

  // Extract entries using regex (simpler than XML parsing for this case)
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;
  let entryCount = 0;

  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    entryCount++;
    const entryXml = entryMatch[1];
    
    try {
      const paper = parseEntry(entryXml);
      if (paper) {
        papers.push(paper);
        console.log(`[arXiv Tool] ✅ Successfully parsed entry ${entryCount}: ${paper.id}`);
      } else {
        console.warn(`[arXiv Tool] ⚠️ Entry ${entryCount} returned null after parsing`);
      }
    } catch (error) {
      console.warn(`[arXiv Tool] ⚠️ Failed to parse entry ${entryCount}:`, error);
      continue;
    }
  }

  console.log(`[arXiv Tool] 📊 XML parsing completed: ${papers.length}/${entryCount} entries successfully parsed`);
  return papers;
};

const parseEntry = (entryXml: string): ArxivEntry | null => {
  const extractText = (tag: string): string => {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's');
    const match = entryXml.match(regex);
    return match ? match[1].trim().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ') : '';
  };

  const extractMultiple = (tag: string): string[] => {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gs');
    const matches = [...entryXml.matchAll(regex)];
    return matches.map(match => match[1].trim().replace(/<[^>]*>/g, '').replace(/\s+/g, ' '));
  };

  const extractLink = (): string => {
    const linkRegex = /<link[^>]*href="([^"]*)"[^>]*title="pdf"/;
    const match = entryXml.match(linkRegex);
    if (match) return match[1];
    
    // Fallback to abstract link
    const abstractLinkRegex = /<link[^>]*href="([^"]*)"[^>]*type="text\/html"/;
    const abstractMatch = entryXml.match(abstractLinkRegex);
    return abstractMatch ? abstractMatch[1] : '';
  };

  const id = extractText('id');
  const title = extractText('title');
  const abstract = extractText('summary');
  const published = extractText('published');
  const updated = extractText('updated');

  if (!id || !title) {
    return null;
  }

  // Extract authors
  const authors = extractMultiple('name');

  // Extract categories
  const categoryRegex = /<category[^>]*term="([^"]*)"[^>]*\/>/g;
  const categories: string[] = [];
  let categoryMatch;
  while ((categoryMatch = categoryRegex.exec(entryXml)) !== null) {
    categories.push(categoryMatch[1]);
  }

  // Extract arXiv ID from the full ID
  const arxivIdMatch = id.match(/abs\/(.+)$/);
  const arxivId = arxivIdMatch ? arxivIdMatch[1] : id;

  return {
    id: arxivId,
    title,
    authors,
    abstract,
    categories,
    published: formatDate(published),
    updated: formatDate(updated),
    link: extractLink() || `https://arxiv.org/abs/${arxivId}`,
  };
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch {
    return dateString;
  }
};