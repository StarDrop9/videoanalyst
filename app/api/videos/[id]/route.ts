export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: {
        OR: [
          { id: id },
          { videoId: id },
        ],
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({
      video: {
        ...(video ?? {}),
        createdAt: video?.createdAt?.toISOString?.() ?? '',
        updatedAt: video?.updatedAt?.toISOString?.() ?? '',
        chatMessages: (video?.chatMessages ?? []).map((m: any) => ({
          ...(m ?? {}),
          createdAt: m?.createdAt?.toISOString?.() ?? '',
        })),
      },
    });
  } catch (error: any) {
    console.error('Video fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { OR: [{ id }, { videoId: id }] },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    await prisma.video.delete({ where: { id: video.id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Video delete error:', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
