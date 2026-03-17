'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { History, Video, Loader2, Clock, Trash2 } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { motion } from 'framer-motion';
import type { VideoData } from '@/lib/types';
import Image from 'next/image';

export default function HistoryPage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchVideos();
  }, []);

  const deleteVideo = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this video from history?')) return;
    try {
      await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      setVideos(prev => prev.filter(v => v.videoId !== videoId));
    } catch (e: any) {
      console.error('Failed to delete video:', e);
    }
  };

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      const data = await res?.json?.();
      setVideos(data?.videos ?? []);
    } catch (e: any) {
      console.error('Failed to fetch videos:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date?.toLocaleDateString?.('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) ?? dateStr;
    } catch {
      return dateStr ?? '';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <History className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Video History</h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-60">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (videos?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
              <Video className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No videos analyzed yet</p>
              <button
                onClick={() => router.push('/')}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
              >
                Analyze your first video
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {(videos ?? []).map((video: any, i: number) => (
                <motion.div
                  key={video?.id ?? i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    onClick={() => router.push(`/video/${video?.videoId ?? ''}`)}
                    className="w-full flex items-center gap-4 bg-card border border-border rounded-xl p-3 hover:bg-accent/50 transition-all text-left group"
                  >
                    <div className="relative w-32 aspect-video bg-muted rounded-lg overflow-hidden shrink-0">
                      {video?.thumbnailUrl ? (
                        <Image
                          src={video.thumbnailUrl}
                          alt={video?.title ?? 'Video thumbnail'}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                          sizes="128px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {video?.title ?? 'Untitled'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(video?.createdAt ?? '')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Delete from history"
                      onClick={(e) => deleteVideo(e, video?.videoId ?? '')}
                      className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
