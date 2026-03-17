'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';

interface VideoPlayerProps {
  videoId: string;
}

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ videoId }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (iframeRef?.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'seekTo',
            args: [seconds, true],
          }),
          '*'
        );
      }
    },
  }));

  if (!mounted || !videoId) return null;

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window?.location?.origin : ''}`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube Video Player"
      />
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
