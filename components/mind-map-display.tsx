'use client';

import { useRef, useEffect, useState } from 'react';
import { Network } from 'lucide-react';

interface MindMapDisplayProps {
  summary: string;
  title: string;
  isActive?: boolean;
}

export default function MindMapDisplay({ summary, title, isActive }: MindMapDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isActive || !summary || !svgRef.current) return;
    let destroyed = false;

    async function renderMap() {
      const { Transformer } = await import('markmap-lib');
      const { Markmap } = await import('markmap-view');
      if (destroyed || !svgRef.current) return;

      const cleaned = summary.replace(
        /^(#{1,2}\s*)\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/gm,
        '$1'
      );
      const markdown = `# ${title}\n${cleaned}`;

      const transformer = new Transformer();
      const { root } = transformer.transform(markdown);

      // Collapse top 4 and bottom 4 branches when there are more than 8 sections
      const children = root.children ?? [];
      if (children.length > 8) {
        [
          ...Array.from({ length: 4 }, (_, i) => i),
          ...Array.from({ length: 4 }, (_, i) => children.length - 4 + i),
        ].forEach(i => {
          if (children[i]) children[i].payload = { ...(children[i].payload ?? {}), fold: 1 };
        });
      }

      if (mmRef.current) mmRef.current.destroy();
      svgRef.current.innerHTML = '';

      // Set explicit pixel dimensions so markmap can resolve relative lengths
      const { clientWidth, clientHeight } = svgRef.current.parentElement ?? { clientWidth: 800, clientHeight: 500 };
      svgRef.current.setAttribute('width', String(clientWidth || 800));
      svgRef.current.setAttribute('height', String(clientHeight || 500));

      mmRef.current = Markmap.create(svgRef.current, {
        duration: 0,
        maxWidth: 300,
        paddingX: 16,
        color: () => '#00ff88',
      }, root);

      setTimeout(() => mmRef.current?.fit(), 50);
      setLoading(false);
    }

    renderMap();

    return () => { destroyed = true; };
  }, [summary, title, isActive]);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        <Network className="w-5 h-5 mr-2" />
        No summary available for mind map
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Building mind map...</p>
        </div>
      )}
      <svg
        ref={svgRef}
        className="mindmap-svg w-full h-full"

      />
    </div>
  );
}
