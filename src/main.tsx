import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx';
import { Lightmap } from './components/Lightmap.tsx';


function generateMatrix(
  rows: number = 300,
  cols: number = 500,
  time: number
): Array<Array<[[number, number, number], number]>> {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => {
      const x = i + 1;
      const y = j + 1;

      const z = Math.floor(Math.random() * 101);

      const centerX = rows / 2 + Math.sin(time) * (rows * 0.2);
      const centerY = cols / 2 + Math.cos(time) * (cols * 0.2);

      const dx = x - centerX;
      const dy = y - centerY;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = Math.sqrt((rows / 2) ** 2 + (cols / 2) ** 2);

      const value = Math.round(100 * (1 - distance / maxDistance));

      return [[x, y, z], Math.max(0, value)];
    })
  );
}

let matrix : Array<Array<[[number, number, number], number]>> = generateMatrix(300, 500, 10)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App></App>
  </StrictMode>,
)


// mudar cor
// só atualiza o cursor quando o mexemos
// ver resuloção
