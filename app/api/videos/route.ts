export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        videoId: true,
        youtubeUrl: true,
        title: true,
        thumbnailUrl: true,
        createdAt: true,
      },
    });

    const serialized = (videos ?? []).map((v: any) => ({
      ...(v ?? {}),
      createdAt: v?.createdAt?.toISOString?.() ?? '',
    }));

    return NextResponse.json({ videos: serialized });
  } catch (error: any) {
    console.error('Videos fetch error:', error);
    return NextResponse.json({ videos: [] });
  }
}
