export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractVideoId, formatTimestamp } from '@/lib/youtube';

function extractBalancedJson(html: string, startIdx: number): string {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(startIdx, i + 1);
    }
  }
  throw new Error('Could not find balanced JSON end');
}

async function fetchTranscriptDirect(videoId: string): Promise<any[]> {
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  };

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: browserHeaders,
  });

  if (!pageRes.ok) throw new Error(`YouTube page fetch failed: ${pageRes.status}`);

  const html = await pageRes.text();

  // Extract ytInitialPlayerResponse JSON — split approach is more reliable than regex for deep nesting
  const markerIndex = html.indexOf('ytInitialPlayerResponse = {');
  if (markerIndex === -1) {
    const markerIndex2 = html.indexOf('ytInitialPlayerResponse={');
    if (markerIndex2 === -1) throw new Error('ytInitialPlayerResponse not found in page HTML');
    const jsonStart2 = html.indexOf('{', markerIndex2);
    const jsonStr2 = extractBalancedJson(html, jsonStart2);
    const playerResponse2 = JSON.parse(jsonStr2);
    return extractCaptionsFromPlayerResponse(playerResponse2, videoId, browserHeaders);
  }

  const jsonStart = html.indexOf('{', markerIndex);
  const jsonStr = extractBalancedJson(html, jsonStart);
  const playerResponse = JSON.parse(jsonStr);
  return extractCaptionsFromPlayerResponse(playerResponse, videoId, browserHeaders);
}

async function extractCaptionsFromPlayerResponse(playerResponse: any, videoId: string, headers: Record<string, string>): Promise<any[]> {
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks?.length) throw new Error('No caption tracks in player response');

  // Prefer English captions
  const enTrack = captionTracks.find((t: any) => t.languageCode === 'en' && !t.kind?.includes('asr'))
    ?? captionTracks.find((t: any) => t.languageCode === 'en')
    ?? captionTracks.find((t: any) => t.languageCode?.startsWith('en'))
    ?? captionTracks[0];

  if (!enTrack?.baseUrl) throw new Error('No caption URL found');

  const captionRes = await fetch(enTrack.baseUrl + '&fmt=json3', { headers });
  if (!captionRes.ok) throw new Error(`Caption fetch failed: ${captionRes.status}`);

  const captionData = await captionRes.json();
  const events = captionData?.events ?? [];

  return events
    .filter((e: any) => e.segs?.length)
    .map((e: any) => ({
      text: e.segs.map((s: any) => s.utf8 ?? '').join('').trim().replace(/\n/g, ' '),
      offset: (e.tStartMs ?? 0) / 1000,
      duration: (e.dDurationMs ?? 0) / 1000,
    }))
    .filter((item: any) => item.text);
}

async function fetchTranscript(videoId: string): Promise<{ items: any[]; warning?: string }> {
  // Try direct page-parsing approach first (works in more environments)
  try {
    const items = await fetchTranscriptDirect(videoId);
    if (items?.length) {
      console.log(`Direct transcript fetch succeeded: ${items.length} items`);
      return { items };
    }
  } catch (e: any) {
    console.log('Direct transcript fetch failed:', e?.message);
  }

  // Fallback: youtube-transcript package
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const langOptions = ['en', 'en-US', 'en-GB', undefined];

    for (const lang of langOptions) {
      try {
        const config = lang ? { lang } : undefined;
        const items = await YoutubeTranscript.fetchTranscript(videoId, config);
        if (items?.length) {
          return {
            items: items.map((item: any) => ({
              text: item?.text ?? '',
              offset: typeof item?.offset === 'number' ? item.offset / 1000 : (item?.offset ?? 0),
              duration: typeof item?.duration === 'number' ? item.duration / 1000 : (item?.duration ?? 0),
            })),
          };
        }
      } catch (e: any) {
        console.log('youtube-transcript attempt failed (' + (lang ?? 'default') + '):', e?.message);
      }
    }
  } catch (e: any) {
    console.log('youtube-transcript import failed:', e?.message);
  }

  // All attempts failed
  console.warn('No transcript available for video:', videoId);
  return {
    items: [],
    warning: 'No transcript is available for this video (transcripts may be disabled by the uploader). A basic summary has been generated from video metadata only.',
  };
}

function buildThumbUrl(vid: string): string {
  // Build dynamically to avoid static URL rewriting
  const host = 'img.youtube.com';
  const protocol = 'https';
  return protocol + '://' + host + '/vi/' + vid + '/hqdefault.jpg';
}

async function fetchVideoInfo(videoId: string) {
  try {
    const oembedUrl = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId + '&format=json';
    const res = await fetch(oembedUrl);
    if (res?.ok) {
      const data = await res.json();
      return {
        title: data?.title ?? 'Untitled Video',
        thumbnailUrl: buildThumbUrl(videoId),
      };
    }
  } catch (e: any) {
    console.error('Video info fetch error:', e?.message);
  }
  return {
    title: 'YouTube Video',
    thumbnailUrl: buildThumbUrl(videoId),
  };
}

async function generateSummary(transcript: any[], title: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  const hasTranscript = transcript?.length > 0;

  const transcriptText = hasTranscript
    ? (transcript ?? []).map((item: any) => {
        const seconds = item?.offset ?? 0;
        const ts = formatTimestamp(seconds);
        return '[' + ts + '] ' + (item?.text ?? '');
      }).join('\n')
    : '';

  const systemPrompt = hasTranscript
    ? 'You are an expert video summarizer. Create a detailed, timestamped summary of this YouTube video. Always respond in English regardless of the transcript language.\n\nFormat your response as a structured summary with timestamp sections. Use this exact format:\n\n## [MM:SS] Section Title\n- Key point 1\n- Key point 2\n- Key point 3\n\n## [MM:SS] Next Section Title\n- Key point 1\n- Key point 2\n\nRules:\n- Always write in English\n- Use timestamps from the transcript to mark each section\n- Group related content into logical sections\n- Each section should have 2-5 bullet points\n- Be concise but capture all important information\n- Start with an overview section\n- Use the actual timestamps from the transcript'
    : 'You are an expert video analyst. Always respond in English. The transcript for this video is not available (it may be disabled by the uploader). Based on the video title, provide a helpful overview of what this video likely covers.\n\nFormat your response as:\n\n## [00:00] Overview\n- What this video is likely about based on the title\n- Expected topics that would be covered\n- Key themes suggested by the title\n\nNote: This is an AI-generated estimate based on the video title only, since no transcript is available.';

  const userContent = hasTranscript
    ? 'Video Title: ' + title + '\n\nTranscript:\n' + transcriptText
    : 'Video Title: ' + title + '\n\n(No transcript available — please analyze based on the title only)';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response?.ok) {
    const errorText = await response?.text?.() ?? 'Unknown error';
    throw new Error('LLM API error: ' + errorText);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? 'Summary generation failed.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body?.url;

    if (!url) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Check if already exists
    const existing = await prisma.video.findUnique({ where: { videoId } });
    if (existing) {
      return NextResponse.json({
        video: {
          ...(existing ?? {}),
          createdAt: existing?.createdAt?.toISOString?.() ?? '',
          updatedAt: existing?.updatedAt?.toISOString?.() ?? '',
        },
      });
    }

    // Fetch transcript (gracefully handles disabled transcripts)
    const transcriptResult = await fetchTranscript(videoId);
    const transcriptItems = transcriptResult.items;
    const transcriptWarning = transcriptResult.warning;

    // Fetch video info
    const videoInfo = await fetchVideoInfo(videoId);

    // Generate summary (works with or without transcript)
    const summary = await generateSummary(transcriptItems, videoInfo?.title ?? 'Video');

    // Save to database
    const video = await prisma.video.create({
      data: {
        youtubeUrl: url,
        videoId: videoId,
        title: videoInfo?.title ?? 'Untitled',
        thumbnailUrl: videoInfo?.thumbnailUrl ?? null,
        transcript: JSON.stringify(transcriptItems),
        summary: summary,
      },
    });

    return NextResponse.json({
      video: {
        ...(video ?? {}),
        createdAt: video?.createdAt?.toISOString?.() ?? '',
        updatedAt: video?.updatedAt?.toISOString?.() ?? '',
      },
      ...(transcriptWarning ? { warning: transcriptWarning } : {}),
    });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to analyze video' },
      { status: 500 }
    );
  }
}
