'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './chat/ChatMessage';
import { ChatInput } from './chat/ChatInput';
import { ResearchProgress } from './chat/ResearchProgress';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: any[];
  isStreaming?: boolean;
}

interface ResearchStep {
  phase: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  description: string;
  tools?: string[];
  timestamp?: string;
}


export default function DeepPaperChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: '🔬 学術研究動向特化型リサーチエージェントへようこそ！研究分野を入力すると、最新の学術動向、キープレイヤー、重要論文、技術的進展を網羅的に分析します。',
      timestamp: new Date().toISOString()
    }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };


  const handleSendMessage = async (userMessage: string) => {
    if (isLoading) return;

    // Add user message
    addMessage({
      role: 'user',
      content: userMessage
    });

    setIsLoading(true);
    setStreamingMessage('');
    setResearchSteps([]);
    setCurrentPhase('');

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/agents/deep-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          conversationHistory: messages.slice(-5) // Send last 5 messages for context
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let accumulatedText = '';

      // Initialize research progress
      setCurrentPhase('分析開始中');
      setResearchSteps([{
        phase: '戦略策定フェーズ',
        status: 'in-progress',
        description: 'API利用戦略を決定し、最適なツール選択順序を取得中...',
        timestamp: new Date().toISOString()
      }]);

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  console.error('Stream error:', data.error);
                  addMessage({
                    role: 'system',
                    content: `❌ Error: ${data.error}`
                  });
                  break;
                }
                
                if (data.done) {
                  // Final message
                  if (accumulatedText) {
                    addMessage({
                      role: 'assistant',
                      content: accumulatedText,
                      toolCalls: []
                    });
                  }
                  
                  setCurrentPhase('');
                  setResearchSteps(prevSteps => 
                    prevSteps.map(step => ({ ...step, status: 'completed' as const }))
                  );
                  
                  setStreamingMessage('');
                  break;
                }
                
                if (data.chunk) {
                  accumulatedText += data.chunk;
                  setStreamingMessage(accumulatedText);
                  
                  // Detect phase changes in streaming text
                  if (data.chunk.includes('戦略策定') || data.chunk.includes('apiStrategyTool')) {
                    setCurrentPhase('戦略策定中');
                  } else if (data.chunk.includes('初期調査') || data.chunk.includes('braveSearchTool')) {
                    setCurrentPhase('初期調査中');
                    setResearchSteps(prev => [
                      ...prev.map((step: ResearchStep) => ({ ...step, status: 'completed' as const })),
                      {
                        phase: '初期調査フェーズ',
                        status: 'in-progress' as const,
                        description: 'Web検索で研究分野の概要を把握中...',
                        tools: ['braveSearchTool'],
                        timestamp: new Date().toISOString()
                      }
                    ]);
                  } else if (data.chunk.includes('論文収集') || data.chunk.includes('arxiv') || data.chunk.includes('semanticScholar')) {
                    setCurrentPhase('論文収集中');
                    setResearchSteps(prev => [
                      ...prev.map((step: ResearchStep) => ({ ...step, status: 'completed' as const })),
                      {
                        phase: '論文収集フェーズ',
                        status: 'in-progress' as const,
                        description: '複数の学術データベースから論文を並行収集中...',
                        tools: ['arxivEnhancedTool', 'semanticScholarEnhancedTool', 'coreSearchTool', 'jstageTool'],
                        timestamp: new Date().toISOString()
                      }
                    ]);
                  } else if (data.chunk.includes('引用分析') || data.chunk.includes('citationAnalysisTool')) {
                    setCurrentPhase('引用分析中');
                    setResearchSteps(prev => [
                      ...prev.map((step: ResearchStep) => ({ ...step, status: 'completed' as const })),
                      {
                        phase: '引用分析フェーズ',
                        status: 'in-progress' as const,
                        description: '論文間の関係性と影響度を分析中...',
                        tools: ['citationAnalysisTool'],
                        timestamp: new Date().toISOString()
                      }
                    ]);
                  } else if (data.chunk.includes('トレンド統合') || data.chunk.includes('trendSynthesisTool')) {
                    setCurrentPhase('トレンド分析中');
                    setResearchSteps(prev => [
                      ...prev.map((step: ResearchStep) => ({ ...step, status: 'completed' as const })),
                      {
                        phase: 'トレンド統合フェーズ',
                        status: 'in-progress' as const,
                        description: '時系列トレンドと将来予測を実行中...',
                        tools: ['trendSynthesisTool'],
                        timestamp: new Date().toISOString()
                      }
                    ]);
                  }
                }
                
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        addMessage({
          role: 'system',
          content: '🔄 リサーチがキャンセルされました'
        });
      } else {
        console.error('Error:', error);
        addMessage({
          role: 'system',
          content: `❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
      setCurrentPhase('');
      abortControllerRef.current = null;
    }
  };

  const handleCancelResearch = () => {
    if (abortControllerRef.current && isLoading) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Deep Paper Research Agent</h1>
            <p className="text-sm text-gray-600">学術研究動向特化型リサーチエージェント</p>
          </div>
          
          {isLoading && (
            <button
              onClick={handleCancelResearch}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              分析中止
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Research progress */}
        {researchSteps.length > 0 && (
          <ResearchProgress steps={researchSteps} currentPhase={currentPhase} />
        )}

        {/* Messages */}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            toolCalls={message.toolCalls}
            isStreaming={message.isStreaming}
          />
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <ChatMessage
            role="assistant"
            content={streamingMessage}
            isStreaming={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder={isLoading ? "分析中..." : "研究分野を入力してください (例: 機械学習における敵対的攻撃の最新動向)"}
      />

    </div>
  );
} 