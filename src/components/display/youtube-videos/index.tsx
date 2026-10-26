import { useEffect, useEffectEvent, useRef, useCallback } from 'react';
import type { YouTubeVideo } from '@/types';

interface YouTubeVideoDisplayProps {
  video: YouTubeVideo;
  isActive: boolean;
  onSlideNext?: () => void;
}

/**
 * Extracts the YouTube video ID from various URL formats
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtube\.com\/embed\/)([\w-]+)/,
    /(?:youtube\.com\/shorts\/)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Load the YouTube IFrame API script once */
function loadYTApi(): Promise<void> {
  return new Promise(resolve => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existing?.();
      resolve();
    };

    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
}

/**
 * Displays a YouTube video in fullscreen/fullslide mode using YouTube's privacy-enhanced embed.
 * Only creates the player when the slide is active to prevent background playback.
 * Uses the YouTube IFrame Player API for reliable end-of-video detection.
 */
export function YouTubeVideoDisplay({ video, isActive, onSlideNext }: YouTubeVideoDisplayProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleVideoEnded = useEffectEvent(() => onSlideNext?.());

  const videoId = extractVideoId(video.youtube_url);

  const destroyPlayer = useCallback(() => {
    try {
      playerRef.current?.destroy();
    } catch {
      // Player may already be disposed
    }
    playerRef.current = null;
    // Clear the container so next init has a fresh target div
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, []);

  useEffect(() => {
    if (!isActive || !videoId || !containerRef.current) {
      destroyPlayer();
      return;
    }

    let cancelled = false;

    const init = async () => {
      await loadYTApi();
      if (cancelled) return;

      destroyPlayer();

      // Create a fresh target div for the player
      const target = document.createElement('div');
      target.id = `yt-target-${video.id}`;
      containerRef.current!.appendChild(target);

      playerRef.current = new YT.Player(target, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          disablekb: 1,
          modestbranding: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          loop: video.loop_video ? 1 : 0,
          playlist: video.loop_video ? videoId : undefined,
        },
        events: {
          onReady: (event: YT.PlayerReadyEvent) => {
            const iframe = event.target as unknown as { getIframe: () => HTMLIFrameElement };
            if (iframe.getIframe) {
              const el = iframe.getIframe();
              el.style.width = '100%';
              el.style.height = '100%';
              el.style.border = 'none';
              el.setAttribute('allow', 'autoplay; encrypted-media');
            }
            event.target.playVideo();
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (event.data === 0) {
              // 0 = ENDED
              if (!video.loop_video) handleVideoEnded();
            }
          },
        },
      });
    };

    init();

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [isActive, videoId, video.id, video.loop_video, destroyPlayer]);

  if (!videoId) return null;

  return (
    <div className='w-full h-screen overflow-hidden bg-black'>
      <div ref={containerRef} className='w-full h-full' />
    </div>
  );
}
