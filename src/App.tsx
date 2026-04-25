import { useEffect, useRef, useState } from "react";
import { Lightmap } from "./components/Lightmap";

const GRID_SIZE = 150;

type StaticCell = {
  x: number;
  y: number;
  z: number;
};

function buildStaticGrid(size: number): StaticCell[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      x: i + 1,
      y: j + 1,
      z: Math.floor(Math.random() * 101),
    }))
  );
}

function buildMatrix(
  staticGrid: StaticCell[][],
  size: number,
  time: number
): Array<Array<[[number, number, number], number]>> {
  const centerX = size / 2 + Math.sin(time) * 10;
  const centerY = size / 2 + Math.cos(time) * 10;
  const maxDistance = Math.sqrt((size / 2) ** 2 + (size / 2) ** 2);

  return staticGrid.map((row) =>
    row.map(({ x, y, z }) => {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Valores no intervalo [-100, 100] para usar a paleta divergente
      const value = Math.round(200 * (1 - distance / maxDistance) - 100);
      return [[x, y, z], value];
    })
  );
}

export function App() {
  
  const staticGridRef = useRef<StaticCell[][]>(buildStaticGrid(GRID_SIZE));
  const [matrix, setMatrix] = useState(() =>
    buildMatrix(staticGridRef.current, GRID_SIZE, 0)
  );

  useEffect(() => {
    let time = 0;

    const interval = setInterval(() => {
      time += 0.15;
      setMatrix(buildMatrix(staticGridRef.current, GRID_SIZE, time));
    }, 100);

    return () => clearInterval(interval);
  }, []);
  
  return <Lightmap data={matrix} width={400} height={400} resolution={1} />;
  
}