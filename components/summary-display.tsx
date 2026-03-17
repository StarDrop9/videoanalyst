'use client';

import { useMemo } from 'react';
import { Clock, BookOpen } from 'lucide-react';
import { timestampToSeconds } from '@/lib/youtube';

interface SummaryDisplayProps {
  summary: string;
  onTimestampClick: (seconds: number) => void;
}

interface ParsedSection {
  timestamp: string;
  seconds: number;
  title: string;
  content: string[];
}

export default function SummaryDisplay({ summary, onTimestampClick }: SummaryDisplayProps) {
  const sections = useMemo(() => {
    if (!summary) return [];
    const result: ParsedSection[] = [];
    const lines = summary?.split?.('\n') ?? [];
    let current: ParsedSection | null = null;

    for (const line of lines) {
      const headerMatch = line?.match?.(/^##?\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)/);
      if (headerMatch) {
        if (current) result.push(current);
        const ts = headerMatch[1] ?? '00:00';
        current = {
          timestamp: ts,
          seconds: timestampToSeconds(ts),
          title: (headerMatch[2] ?? '').replace(/^[\s-:]+/, ''),
          content: [],
        };
      } else if (current && line?.trim?.()) {
        current.content.push(line?.trim?.() ?? '');
      }
    }
    if (current) result.push(current);

    // If no sections found, treat as raw text
    if (result.length === 0 && summary?.trim?.()) {
      result.push({
        timestamp: '00:00',
        seconds: 0,
        title: 'Summary',
        content: summary.split('\n').filter((l: string) => l?.trim?.()),
      });
    }

    return result;
  }, [summary]);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        <BookOpen className="w-5 h-5 mr-2" />
        No summary available
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {(sections ?? []).map((section: ParsedSection, i: number) => (
        <div key={i} className="group">
          <button
            onClick={() => onTimestampClick?.(section?.seconds ?? 0)}
            className="flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity"
          >
            <span className="flex items-center gap-1 text-xs font-mono bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              {section?.timestamp ?? '00:00'}
            </span>
            <span className="text-sm font-medium text-foreground">
              {section?.title ?? ''}
            </span>
          </button>
          <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-1">
            {(section?.content ?? []).map((line: string, j: number) => {
              const cleaned = (line ?? '').replace(/^[-*•]\s*/, '');
              // Make inline timestamps clickable
              const parts = cleaned?.split?.(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/) ?? [cleaned];
              return (
                <p key={j} className="text-xs text-foreground/75 leading-relaxed">
                  {(parts ?? []).map((part: string, k: number) => {
                    const tsMatch = part?.match?.(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]$/);
                    if (tsMatch) {
                      return (
                        <button
                          key={k}
                          onClick={() => onTimestampClick?.(timestampToSeconds(tsMatch[1] ?? '00:00'))}
                          className="text-primary hover:underline font-mono mx-0.5"
                        >
                          {part}
                        </button>
                      );
                    }
                    return <span key={k}>{part ?? ''}</span>;
                  })}
                </p>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
