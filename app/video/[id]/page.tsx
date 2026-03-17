'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Sparkles, MessageSquare, Network, Loader2, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/sidebar';
import VideoPlayer, { VideoPlayerRef } from '@/components/video-player';
import TranscriptViewer from '@/components/transcript-viewer';
import SummaryDisplay from '@/components/summary-display';
import ChatInterface from '@/components/chat-interface';
import type { VideoData, TranscriptItem, ChatMessageData } from '@/lib/types';

const MindMapDisplay = dynamic(() => import('@/components/mind-map-display'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
      Loading mind map...
    </div>
  ),
});

type TabType = 'summary' | 'chat' | 'mindmap';

export default function VideoPage() {
  const params = useParams();
  const videoId = (params?.id as string) ?? '';
  const [video, setVideo] = useState<VideoData | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const playerRef = useRef<VideoPlayerRef>(null);

  useEffect(() => {
    if (videoId) {
      fetchVideo();
    }
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/videos/${videoId}`);
      const data = await res?.json?.();

      if (!res?.ok) {
        throw new Error(data?.error ?? 'Failed to load video');
      }

      setVideo(data?.video ?? null);
      setChatMessages(data?.video?.chatMessages ?? []);

      // Parse transcript
      try {
        const items = JSON.parse(data?.video?.transcript ?? '[]');
        setTranscript(items ?? []);
      } catch (e: any) {
        setTranscript([]);
      }
    } catch (err: any) {
      console.error('Fetch video error:', err);
      setError(err?.message ?? 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const handleTimestampClick = useCallback((seconds: number) => {
    playerRef?.current?.seekTo?.(seconds);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading video analysis...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive">{error || 'Video not found'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left side: Video + Transcript */}
        <div className="lg:w-[58%] flex flex-col overflow-hidden border-r border-border">
          {/* Video Player */}
          <div className="p-4 pb-2">
            <VideoPlayer ref={playerRef} videoId={videoId} />
            <h1 className="text-sm font-semibold mt-3 px-1 line-clamp-2">{video?.title ?? 'Untitled'}</h1>
          </div>

          {/* Transcript */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-4 py-2 border-y border-border bg-card/50">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Transcript</span>
              <span className="text-xs text-muted-foreground">({transcript?.length ?? 0} segments)</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TranscriptViewer transcript={transcript} onTimestampClick={handleTimestampClick} />
            </div>
          </div>
        </div>

        {/* Right side: Summary + Chat */}
        <div className="lg:w-[42%] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border bg-card/50">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'summary'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Summary
              {activeTab === 'summary' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'chat'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              AI Chat
              {activeTab === 'chat' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('mindmap')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'mindmap'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Network className="w-4 h-4" />
              Mind Map
              {activeTab === 'mindmap' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <div className={`h-full overflow-y-auto ${activeTab === 'summary' ? '' : 'hidden'}`}>
              <SummaryDisplay
                summary={video?.summary ?? ''}
                onTimestampClick={handleTimestampClick}
              />
            </div>
            <div className={`h-full overflow-y-auto ${activeTab === 'chat' ? '' : 'hidden'}`}>
              <ChatInterface
                videoId={videoId}
                dbVideoId={video?.id ?? ''}
                initialMessages={chatMessages}
                onTimestampClick={handleTimestampClick}
              />
            </div>
            <div className={`h-full ${activeTab === 'mindmap' ? '' : 'hidden'}`}>
              <MindMapDisplay
                summary={video?.summary ?? ''}
                title={video?.title ?? 'Video Summary'}
                isActive={activeTab === 'mindmap'}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
