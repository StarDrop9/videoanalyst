export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db';

const PROMPT = `You are analyzing a YouTube video to create a Visual Transcript.

Provide a structured breakdown of what is happening VISUALLY in this video. Focus on:
- What is shown on screen (scenes, settings, people, objects)
- Actions and demonstrations being performed
- Text, captions, or titles visible on screen
- Key visual moments and transitions
- Body language and expressions if people are visible

Format your response as sections with timestamps using this exact format:

## [MM:SS] Scene Title

Under each heading, add bullet points describing what is visually happening at that moment.

Keep timestamps accurate to the video. Respond in English only, regardless of any language visible in the video.`;

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'videoId required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const video = await prisma.video.findFirst({
      where: { OR: [{ id: videoId }, { videoId }] },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: youtubeUrl,
        },
      },
      { text: PROMPT },
    ]);

    const visualTranscript = result.response.text();

    await prisma.video.update({
      where: { id: video.id },
      data: { visualTranscript },
    });

    return NextResponse.json({ visualTranscript });
  } catch (error: any) {
    console.error('Visual transcript error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to generate visual transcript' },
      { status: 500 }
    );
  }
}
