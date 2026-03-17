'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import type { ChatMessageData } from '@/lib/types';
import { timestampToSeconds } from '@/lib/youtube';

interface ChatInterfaceProps {
  videoId: string;
  dbVideoId: string;
  initialMessages?: ChatMessageData[];
  onTimestampClick: (seconds: number) => void;
}

export default function ChatInterface({ videoId, dbVideoId, initialMessages, onTimestampClick }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    () => (initialMessages ?? []).map((m: any) => ({ role: m?.role ?? 'user', content: m?.content ?? '' }))
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearChat = async () => {
    if (!confirm('Clear all chat messages for this video?')) return;
    try {
      await fetch(`/api/chat?videoId=${dbVideoId || videoId}`, { method: 'DELETE' });
      setMessages([]);
    } catch (e: any) {
      console.error('Failed to clear chat:', e);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input?.trim?.() ?? '';
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev: any) => [...(prev ?? []), userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: dbVideoId || videoId, message: trimmed }),
      });

      if (!res?.ok) {
        const errData = await res?.json?.().catch(() => ({}));
        throw new Error(errData?.error ?? 'Chat request failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let partialRead = '';

      setMessages((prev: any) => [...(prev ?? []), { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() ?? '';

        for (const line of lines) {
          if (line?.startsWith?.('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed?.error) {
                throw new Error(parsed.error);
              }
              if (parsed?.content) {
                assistantContent += parsed.content;
                setMessages((prev: any) => {
                  const arr = [...(prev ?? [])];
                  if (arr.length > 0) {
                    arr[arr.length - 1] = { role: 'assistant', content: assistantContent };
                  }
                  return arr;
                });
              }
            } catch (e: any) {
              if (e?.message && e.message !== 'Unexpected end of JSON input') {
                console.error('Parse error:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages((prev: any) => {
        const arr = [...(prev ?? [])];
        // If last message is empty assistant, replace it
        if (arr.length > 0 && arr[arr.length - 1]?.role === 'assistant' && !arr[arr.length - 1]?.content) {
          arr[arr.length - 1] = { role: 'assistant', content: `Sorry, I encountered an error: ${error?.message ?? 'Unknown error'}` };
        } else {
          arr.push({ role: 'assistant', content: `Sorry, I encountered an error: ${error?.message ?? 'Unknown error'}` });
        }
        return arr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    const parts = content?.split?.(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/) ?? [content];
    return (parts ?? []).map((part: string, i: number) => {
      const tsMatch = part?.match?.(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]$/);
      if (tsMatch) {
        return (
          <button
            key={i}
            onClick={() => onTimestampClick?.(timestampToSeconds(tsMatch[1] ?? '00:00'))}
            className="text-primary hover:underline font-mono text-xs mx-0.5"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part ?? ''}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(messages?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="w-10 h-10 text-primary/40 mb-3" />
            <p className="text-sm text-muted-foreground">Ask anything about this video</p>
            <p className="text-xs text-muted-foreground/60 mt-1">AI will reference the transcript and summary to answer</p>
          </div>
        )}
        {(messages ?? []).map((msg: any, i: number) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg?.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg?.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg?.role === 'user'
                  ? 'bg-primary/80 text-primary-foreground/80'
                  : 'bg-secondary/40 text-foreground/75'
              }`}
            >
              {msg?.role === 'user' ? msg?.content ?? '' : renderContent(msg?.content ?? '')}
              {msg?.role === 'assistant' && !msg?.content && isLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {msg?.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-foreground/70" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e: any) => setInput(e?.target?.value ?? '')}
            onKeyDown={(e: any) => {
              if (e?.key === 'Enter' && !e?.shiftKey) {
                e?.preventDefault?.();
                sendMessage();
              }
            }}
            placeholder="Ask about this video..."
            disabled={isLoading}
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="button"
            title="Clear chat"
            onClick={clearChat}
            disabled={isLoading || messages.length === 0}
            className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={sendMessage}
            disabled={isLoading || !(input?.trim?.())}
            className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
