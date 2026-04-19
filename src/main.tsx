import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Lightmap } from './components/Lightmap.tsx';


const matrix: Array<Array<[[number, number], number]>> = [
  [
    [[1, 1], 45],
    [[1, 2], 35],
    [[1, 3], 40],
  ],
  [
    [[2, 1], 100],
    [[2, 2], 55],
    [[1, 3], 1],
  ],
  [
    [[3, 1], 0],
    [[3, 2], 0],
    [[3, 3], 1],
  ]
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
