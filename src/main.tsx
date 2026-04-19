import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Lightmap } from './components/Lightmap.tsx';


const matrix: Array<Array<[[number, number], number]>> = [
  [
    [[1, 1], 1],
    [[1, 2], 10],
  ],
  [
    [[2, 1], 10],
    [[2, 2], 3],
  ],
];

//type LightmapPoint = [[number, number], number]
//type LightmapMatrix = LightmapPoint[][]

const height = 2;
const width = 2;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lightmap data = {matrix} width = {width} height = {height} />
  </StrictMode>,
)
