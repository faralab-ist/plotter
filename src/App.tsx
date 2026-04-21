import { useEffect, useState } from "react";
import { Lightmap } from "./components/Lightmap";

export function App() {
  const [matrix, setMatrix] = useState(generateMatrix(50, 0));

  useEffect(() => {
    let time = 0;

    const interval = setInterval(() => {
      time += 0.15;
      setMatrix(generateMatrix(50, time));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return <Lightmap data={matrix} width={50} height={50} />;
}

function generateMatrix(
  size: number,
  time: number
): Array<Array<[[number, number, number], number]>> {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      const x = i + 1;
      const y = j + 1;

      // z aleatório (0 a 100)
      const z = Math.floor(Math.random() * 101);

      const centerX = size / 2 + Math.sin(time) * 10;
      const centerY = size / 2 + Math.cos(time) * 10;

      const dx = x - centerX;
      const dy = y - centerY;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = Math.sqrt((size / 2) ** 2 + (size / 2) ** 2);

      const value = Math.round(100 * (1 - distance / maxDistance));

      return [[x, y, z], Math.max(0, value)];
    })
  );
}