export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractVideoId, formatTimestamp } from '@/lib/youtube';

async function fetchTranscript(videoId: string): Promise<{ items: any[]; warning?: string }> {
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
      console.log('Transcript attempt failed (' + (lang ?? 'default') + '):', e?.message);
      continue;
    }
  }

  // All attempts failed — return empty with warning
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
      model: 'google/gemini-2.5-flash-preview',
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
