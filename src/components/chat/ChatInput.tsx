'use client';

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSendMessage, 
  disabled = false,
  placeholder = "Enter your research topic..."
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex space-x-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   disabled:bg-gray-100 disabled:cursor-not-allowed
                   min-h-[40px] max-h-[120px] text-black"
          style={{
            height: 'auto',
            minHeight: '40px'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        
        <button
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 
                   disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors duration-200 flex items-center justify-center
                   min-w-[80px]"
        >
          {disabled ? (
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">...</span>
            </div>
          ) : (
            'Send'
          )}
        </button>
      </div>
      
      {/* Helpful hints */}
      <div className="mt-2 text-xs text-gray-500">
        💡 Try: &quot;machine learning trends&quot;, &quot;quantum computing breakthroughs&quot;, &quot;AI safety research&quot;
      </div>
    </div>
  );
}