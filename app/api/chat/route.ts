export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { formatTimestamp } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, message } = body ?? {};

    if (!videoId || !message) {
      return new Response(JSON.stringify({ error: 'videoId and message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const video = await prisma.video.findFirst({
      where: {
        OR: [
          { id: videoId },
          { videoId: videoId },
        ],
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    });

    if (!video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        videoId: video.id,
        role: 'user',
        content: message,
      },
    });

    // Build transcript context
    let transcriptText = '';
    try {
      const items = JSON.parse(video?.transcript ?? '[]');
      transcriptText = (items ?? []).slice(0, 500).map((item: any) => {
        const ts = formatTimestamp(item?.offset ?? 0);
        return `[${ts}] ${item?.text ?? ''}`;
      }).join('\n');
    } catch (e: any) {
      transcriptText = 'Transcript not available';
    }

    // Build chat history
    const history = (video?.chatMessages ?? []).map((m: any) => ({
      role: m?.role === 'user' ? 'user' : 'assistant',
      content: m?.content ?? '',
    }));

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hasTranscript = transcriptText && transcriptText !== 'Transcript not available';

    const systemContent = hasTranscript
      ? `You are an AI assistant that helps users understand YouTube videos. Always respond in English regardless of the transcript language.

Video Title: ${video?.title ?? 'Unknown'}

Video Summary:
${video?.summary ?? 'No summary available'}

Transcript:
${transcriptText}

Answer questions about this video accurately and helpfully. Reference specific timestamps when relevant using the format [MM:SS]. Be concise but thorough. Always write in English.`
      : `You are an AI assistant that helps users understand YouTube videos. Always respond in English. NOTE: The transcript for this video is not available (it was disabled by the uploader), so your answers are based on the video title and AI-generated summary only.

Video Title: ${video?.title ?? 'Unknown'}

Video Summary:
${video?.summary ?? 'No summary available'}

Answer questions about this video based on the available information. Be transparent that your knowledge is limited since no transcript was available. Be concise but thorough. Always write in English.`;

    const messages = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: message },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages,
        stream: true,
        max_tokens: 2000,
      }),
    });

    if (!response?.ok) {
      const errorText = await response?.text?.() ?? 'Unknown error';
      return new Response(JSON.stringify({ error: `LLM API error: ${errorText}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let fullContent = '';
    const dbVideoId = video.id;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let partialRead = '';

        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead.split('\n');
            partialRead = lines.pop() ?? '';

            for (const line of lines) {
              if (line?.startsWith?.('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Save assistant message to DB
                  try {
                    await prisma.chatMessage.create({
                      data: {
                        videoId: dbVideoId,
                        role: 'assistant',
                        content: fullContent,
                      },
                    });
                  } catch (e: any) {
                    console.error('Failed to save chat message:', e?.message);
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed?.choices?.[0]?.delta?.content ?? '';
                  if (content) {
                    fullContent += content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e: any) {
                  // Skip invalid JSON
                }
              }
            }
          }

          // If we got here without [DONE], save whatever we have
          if (fullContent) {
            try {
              await prisma.chatMessage.create({
                data: {
                  videoId: dbVideoId,
                  role: 'assistant',
                  content: fullContent,
                },
              });
            } catch (e: any) {
              console.error('Failed to save chat message:', e?.message);
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error?.message ?? 'Stream error' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'Chat failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId required' }), { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { OR: [{ id: videoId }, { videoId }] },
    });

    if (!video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), { status: 404 });
    }

    await prisma.chatMessage.deleteMany({ where: { videoId: video.id } });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Clear chat error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'Failed to clear chat' }), { status: 500 });
  }
}
