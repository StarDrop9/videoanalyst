'use client';

import { useState } from 'react';
import { Eye, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  dbVideoId: string;
  visualTranscript: string | null;
  onTimestampClick: (seconds: number) => void;
  onGenerated: (transcript: string) => void;
}

interface Section {
  timestamp: string;
  seconds: number;
  title: string;
  points: string[];
}

function parseSections(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^##?\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)/);
    if (headerMatch) {
      if (current) sections.push(current);
      const [, ts, title] = headerMatch;
      const parts = ts.split(':').map(Number);
      const seconds =
        parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1];
      current = { timestamp: ts, seconds, title: title.trim(), points: [] };
    } else if (current && line.trim().startsWith('-')) {
      current.points.push(line.trim().slice(1).trim());
    } else if (current && line.trim()) {
      current.points.push(line.trim());
    }
  }

  if (current) sections.push(current);
  return sections;
}

export default function VisualTranscriptDisplay({
  dbVideoId,
  visualTranscript,
  onTimestampClick,
  onGenerated,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/visual-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: dbVideoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate');
      onGenerated(data.visualTranscript);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate visual transcript');
    } finally {
      setGenerating(false);
    }
  };

  if (!visualTranscript) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Eye className="w-10 h-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">Visual Transcript</p>
          <p className="text-xs text-muted-foreground mt-1">
            Gemini analyzes video frames to describe scenes, actions, and on-screen text — no captions required.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing video...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Generate Visual Transcript
            </>
          )}
        </button>
      </div>
    );
  }

  const sections = parseSections(visualTranscript);

  if (sections.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{visualTranscript}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {sections.map((section, i) => (
        <div key={i} className="border-l-2 border-primary/30 pl-3">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => onTimestampClick(section.seconds)}
              className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors"
            >
              {section.timestamp}
            </button>
            <span className="text-sm font-medium">{section.title}</span>
          </div>
          <ul className="space-y-1">
            {section.points.map((point, j) => (
              <li key={j} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-primary/50 mt-0.5 flex-shrink-0">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
