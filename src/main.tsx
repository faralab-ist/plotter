import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx';

//type LightmapPoint = [[number, number], number]
//type LightmapMatrix = LightmapPoint[][]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


// mudar cor
// só atualiza o cursor quando o mexemos
// ver resuloção
