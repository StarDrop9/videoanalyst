export interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

export interface VideoData {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: string | null;
  transcript: string | null;
  summary: string | null;
  visualTranscript: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageData {
  id: string;
  videoId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface SummarySection {
  timestamp: string;
  seconds: number;
  title: string;
  points: string[];
}
