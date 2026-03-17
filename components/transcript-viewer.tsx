'use client';

import { useState, useMemo } from 'react';
import { Search, FileText } from 'lucide-react';
import type { TranscriptItem } from '@/lib/types';
import { formatTimestamp } from '@/lib/youtube';

interface TranscriptViewerProps {
  transcript: TranscriptItem[];
  onTimestampClick: (seconds: number) => void;
}

export default function TranscriptViewer({ transcript, onTimestampClick }: TranscriptViewerProps) {
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const arr = transcript ?? [];
    if (!search) return arr;
    return arr.filter((item: any) =>
      (item?.text ?? '')?.toLowerCase?.()?.includes?.(search?.toLowerCase?.() ?? '')
    );
  }, [transcript, search]);

  if (!(transcript?.length)) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2 px-4 text-center">
        <FileText className="w-6 h-6 opacity-50" />
        <p className="font-medium">No transcript available</p>
        <p className="text-xs opacity-70">Transcripts may be disabled by the video uploader. The summary was generated from video metadata only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={search}
            onChange={(e: any) => setSearch(e?.target?.value ?? '')}
            className="w-full bg-secondary/50 border border-border rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {(items ?? []).map((item: any, i: number) => {
          const seconds = item?.offset ?? 0;
          return (
            <div
              key={i}
              className="flex gap-2 py-1.5 px-2 rounded hover:bg-accent/50 cursor-pointer transition-colors group"
              onClick={() => onTimestampClick?.(seconds)}
            >
              <span className="text-xs text-primary font-mono shrink-0 mt-0.5 group-hover:underline">
                {formatTimestamp(seconds)}
              </span>
              <span className="text-xs text-foreground/80 leading-relaxed">
                {item?.text ?? ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
