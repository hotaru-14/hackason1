'use client';

import { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css'; // スタイルシート

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
  toolCalls?: any[];
  children?: ReactNode;
}

export function ChatMessage({ 
  role, 
  content, 
  timestamp, 
  isStreaming = false,
  toolCalls = [],
  children 
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
            ${isUser 
              ? 'bg-blue-500 text-white' 
              : isSystem 
                ? 'bg-gray-500 text-white'
                : 'bg-green-500 text-white'
            }`}>
            {isUser ? 'U' : isSystem ? 'S' : 'AI'}
          </div>
        </div>

        {/* Message bubble */}
        <div className={`rounded-lg px-4 py-2 shadow-md relative
          ${isUser 
            ? 'bg-blue-500 text-white' 
            : isSystem
              ? 'bg-gray-100 text-gray-800 border border-gray-300'
              : 'bg-white text-gray-800 border border-gray-200'
          }`}>
          
          {/* Content */}
          <div className="break-words">
            {isUser ? (
              // ユーザーメッセージは通常のテキスト表示
              <div className="whitespace-pre-wrap">
                {content}
              </div>
            ) : (
              // AIメッセージはMarkdownレンダリング
              <div className="prose prose-sm max-w-none prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-em:text-inherit prose-ul:text-inherit prose-ol:text-inherit prose-li:text-inherit">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    // リンクのスタイル調整
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        {children}
                      </a>
                    ),
                    // コードブロックのスタイル調整
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">
                          {children}
                        </code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-gray-800">
                        {children}
                      </pre>
                    ),
                    // テーブルのスタイル調整
                    table: ({ children }) => (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-300">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold text-left text-gray-800">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-gray-300 px-2 py-1">
                        {children}
                      </td>
                    )
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse">|</span>
            )}
          </div>

          {/* Tool calls indicator */}
          {toolCalls.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-300 text-xs opacity-75">
              🔧 Tools used: {toolCalls.map(tc => tc.toolName).join(', ')}
            </div>
          )}

          {/* Custom children (for special components) */}
          {children}

          {/* Timestamp */}
          {timestamp && (
            <div className={`text-xs mt-1 opacity-60
              ${isUser ? 'text-right text-blue-100' : 'text-left text-gray-500'}
            `}>
              {new Date(timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}