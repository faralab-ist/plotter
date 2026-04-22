import type { LightmapMatrix } from '../components/Lightmap';

export function createDemoMatrix(size: number, time: number): LightmapMatrix {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      const x = i + 1;
      const y = j + 1;
      const z = Math.floor(Math.random() * 101);

      const centerX = size / 2 + Math.sin(time) * 10;
      const centerY = size / 2 + Math.cos(time) * 10;

      const dx = x - centerX;
      const dy = y - centerY;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = Math.sqrt((size / 2) ** 2 + (size / 2) ** 2);
      const value = Math.round(100 * (1 - distance / maxDistance));

      return [[x, y, z], Math.max(0, value)] as [[number, number, number], number];
    }),
  );
}
