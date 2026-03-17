'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Youtube, Sparkles, Loader2, AlertCircle, Play, MessageSquare, FileText, Clock } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { motion } from 'framer-motion';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAnalyze = async () => {
    const trimmedUrl = url?.trim?.() ?? '';
    if (!trimmedUrl) {
      setError('Please enter a YouTube URL');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await res?.json?.();

      if (!res?.ok) {
        throw new Error(data?.error ?? 'Analysis failed');
      }

      const videoId = data?.video?.videoId;
      if (videoId) {
        router.push(`/video/${videoId}`);
      } else {
        throw new Error('No video ID returned');
      }
    } catch (err: any) {
      console.error('Analyze error:', err);
      setError(err?.message ?? 'Failed to analyze video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-2xl text-center space-y-8"
          >
            {/* Hero */}
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">
                Analyze Any <span className="text-primary">YouTube</span> Video
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
                Get AI-powered summaries, timestamped transcripts, and ask questions about any video
              </p>
            </div>

            {/* Input */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e: any) => {
                      setUrl(e?.target?.value ?? '');
                      setError('');
                    }}
                    onKeyDown={(e: any) => {
                      if (e?.key === 'Enter') handleAnalyze();
                    }}
                    placeholder="Paste YouTube URL here..."
                    disabled={loading}
                    className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 transition-all"
                  />
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="px-6 py-3.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze
                    </>
                  )}
                </button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
              {[
                { icon: FileText, label: 'Transcripts', desc: 'With timestamps' },
                { icon: Sparkles, label: 'AI Summary', desc: 'Key insights' },
                { icon: MessageSquare, label: 'Chat Q&A', desc: 'Ask anything' },
                { icon: Clock, label: 'History', desc: 'Past analyses' },
              ].map((feat: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="bg-card/50 border border-border/50 rounded-xl p-4 text-center space-y-1.5"
                >
                  <feat.icon className="w-5 h-5 text-primary mx-auto" />
                  <p className="text-xs font-medium">{feat?.label ?? ''}</p>
                  <p className="text-xs text-muted-foreground">{feat?.desc ?? ''}</p>
                </motion.div>
              ))}
            </div>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card border border-border rounded-xl p-6 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">Analyzing video...</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Play className="w-3.5 h-3.5" />
                    <span>Extracting transcript and metadata</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generating AI summary with timestamps</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/60">This may take 30-60 seconds</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
