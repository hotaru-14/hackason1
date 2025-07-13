import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const corePaperSchema = z.object({
  coreId: z.string(),
  title: z.string(),
  authors: z.array(z.string()).max(3), // 最初の3名のみ
  abstract: z.string().optional(), // アブストラクトを追加
  year: z.number(),
  repository: z.string(),
  doi: z.string().optional(),
});

export const coreSearchTool = createTool({
  id: 'core-search',
  description: 'Search worldwide open access repositories via CORE API',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().min(1).max(100).default(20),
    yearFrom: z.number().optional(),
    yearTo: z.number().optional(),
    repositoryFilter: z.array(z.string()).optional(),
    languageFilter: z.array(z.string()).optional(),
    documentType: z.enum(['article', 'thesis', 'book', 'conference', 'all']).default('all'),
  }),
  outputSchema: z.object({
    papers: z.array(corePaperSchema),
    totalResults: z.number(),
  }),
  execute: async ({ context }) => {
    const { query, maxResults, yearFrom, yearTo, languageFilter, documentType } = context;
    
    try {
      // CORE API endpoint
      const baseUrl = 'https://api.core.ac.uk/v3/search/works';
      
      const params = new URLSearchParams({
        q: query,
        limit: maxResults.toString(),
      });

      // Add filters
      if (yearFrom) params.append('year_from', yearFrom.toString());
      if (yearTo) params.append('year_to', yearTo.toString());
      if (languageFilter && languageFilter.length > 0) {
        params.append('language', languageFilter.join(','));
      }
      if (documentType !== 'all') {
        params.append('type', documentType);
      }

      const url = `${baseUrl}?${params.toString()}`;
      
      console.log(`📡 CORE API request: ${query}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.CORE_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`CORE API error: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      const totalHits = data.totalHits;
      
      // Process results
      interface ProcessedCorePaper {
        coreId: string;
        title: string;
        authors: string[];
        abstract: string;
        year: number;
        language: string;
        repository: string;
        doi?: string;
        downloadUrl?: string;
        subjects: string[];
        documentType: string;
      }

      const papers: ProcessedCorePaper[] = results.map((result: any) => {
        const authors = result.authors?.map((author: any) => author.name || author) || [];
        const subjects = result.subjects || [];
        
        return {
          coreId: result.id || '',
          title: result.title || '',
          authors,
          abstract: result.abstract || '',
          year: result.year || new Date().getFullYear(),
          language: result.language || 'en',
          repository: result.repository?.name || 'Unknown',
          doi: result.doi || undefined,
          downloadUrl: result.downloadUrl || undefined,
          subjects,
          documentType: result.type || 'article',
        };
      });

      // Calculate metadata
      // const repositoriesCovered: string[] = [...new Set(papers.map((paper: ProcessedCorePaper) => paper.repository))];
      
      const languageDistribution: Record<string, number> = {};
      const yearDistribution: Record<string, number> = {};
      
      papers.forEach((paper: ProcessedCorePaper) => {
        languageDistribution[paper.language] = (languageDistribution[paper.language] || 0) + 1;
        yearDistribution[paper.year.toString()] = (yearDistribution[paper.year.toString()] || 0) + 1;
      });

      // 出力スキーマに合わせて変換
      const outputPapers = papers.map(paper => ({
        coreId: paper.coreId,
        title: paper.title,
        authors: paper.authors.slice(0, 3), // 最初の3名のみ
        abstract: paper.abstract || undefined,
        year: paper.year,
        repository: paper.repository,
        doi: paper.doi,
      }));

      return {
        papers: outputPapers,
        totalResults: totalHits || papers.length,
      };
    } catch (error) {
      console.error('CORE search error:', error);
      return {
        papers: [],
        totalResults: 0,
      };
    }
  },
}); 