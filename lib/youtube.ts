export function extractVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = url?.match?.(pattern);
    if (match?.[1]) return match[1];
  }
  if (url?.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) return url;
  return null;
}

export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function timestampToSeconds(ts: string): number {
  const parts = ts?.split?.(':')?.map?.(Number) ?? [];
  if (parts?.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts?.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return 0;
}
