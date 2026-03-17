'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Video, History, Plus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoData } from '@/lib/types';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      const data = await res?.json?.();
      setVideos(data?.videos ?? []);
    } catch (e: any) {
      console.error('Failed to fetch videos:', e);
    }
  };

  return (
    <aside
      className={cn(
        'h-screen bg-card border-r border-border flex flex-col transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm truncate">VideoAnalyzer</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          onClick={() => router.push('/')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            pathname === '/' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>New Analysis</span>}
        </button>

        <button
          onClick={() => router.push('/history')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            pathname === '/history' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <History className="w-4 h-4 shrink-0" />
          {!collapsed && <span>History</span>}
        </button>

        {/* Recent videos */}
        {!collapsed && (videos?.length ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="px-3 text-xs text-muted-foreground font-medium mb-2">Recent Videos</p>
            <div className="space-y-0.5">
              {(videos ?? []).slice(0, 8).map((video: any) => (
                <button
                  key={video?.id ?? ''}
                  onClick={() => router.push(`/video/${video?.videoId ?? ''}`)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left',
                    pathname === `/video/${video?.videoId}` ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Video className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{video?.title ?? 'Untitled'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
