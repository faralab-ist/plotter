import React, { useState, useMemo } from 'react';
import '../styles/Lightmap.css';

interface LightmapCell {
  value: number;
  row: number;
  col: number;
}

interface LightmapProps {
  data: Array<Array<[[number, number], number]>>
  width: number
  height: number
}

const MAX_VALUE = 500; // Valor máximo padrão para normalização
const MIN_VALUE = 0;   // Valor mínimo para normalização

export const Lightmap: React.FC<LightmapProps> = ({data, width, height}) => {
  const [maxMetricValue, setMaxMetricValue] = useState<number>(MAX_VALUE);
  const [lightmapData, setLightmapData] = useState<LightmapCell[]>(() =>
    generateLightmapData()
  );

  function generateLightmapData(): LightmapCell[] {
    const cells: LightmapCell[] = [];
    for (let row = 0; row < data.length; row++) {
        for (let col = 0; col < data[row].length; col++) {
            const value = data[row][col][1];
            cells.push({ value, row, col });
        }
    }
    return cells;
  }

  const normalizedData = useMemo(() => {
    return lightmapData.map(cell => ({
      ...cell,
      normalized: (cell.value - MIN_VALUE) / (maxMetricValue - MIN_VALUE),
    }));
  }, [lightmapData, maxMetricValue]);

  const getColorForValue = (normalizedValue: number): string => {
    // Limitar o valor normalizado entre 0 e 1
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));

    // Paleta de cores baseada na legenda: roxo escuro → roxo → laranja → amarelo
    // Pontos de referência: 0% → 25% → 50% → 75% → 100%
    let hue, saturation, lightness;
    
    if (clampedValue < 0.25) {
      // hsl(286, 88%, 25%) → hsl(288, 99%, 33%)
      const t = clampedValue / 0.25;
      hue = 286 + (288 - 286) * t;
      saturation = 88 + (99 - 88) * t;
      lightness = 25 + (33 - 25) * t;
    } else if (clampedValue < 0.5) {
      // hsl(288, 99%, 33%) → hsl(30, 97%, 47%)
      // Usar 390 para evitar interpolação através de verde/cyan
      const t = (clampedValue - 0.25) / 0.25;
      hue = 288 + (390 - 288) * t;
      if (hue > 360) hue -= 360;
      saturation = 99 + (97 - 99) * t;
      lightness = 33 + (47 - 33) * t;
    } else if (clampedValue < 0.75) {
      // hsl(30, 97%, 47%) → hsl(40, 95%, 50%)
      const t = (clampedValue - 0.5) / 0.25;
      hue = 30 + (40 - 30) * t;
      saturation = 97 + (95 - 97) * t;
      lightness = 47 + (50 - 47) * t;
    } else {
      // hsl(40, 95%, 50%) → hsl(60, 100%, 50%)
      const t = (clampedValue - 0.75) / 0.25;
      hue = 40 + (60 - 40) * t;
      saturation = 95 + (100 - 95) * t;
      lightness = 50;
    }

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const handleRegeneratData = () => {
    setLightmapData(generateLightmapData());
  };

  const handleMaxMetricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (value >= MIN_VALUE) {
      setMaxMetricValue(value);
    }
  };

  return (
    <div className="lightmap-container">
      <h1>Visualizador de Lightmap</h1>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="max-metric">Valor Máximo da Métrica (N):</label>
          <input
            id="max-metric"
            type="number"
            min={MIN_VALUE}
            value={maxMetricValue}
            onChange={handleMaxMetricChange}
            className="metric-input"
          />
        </div>
        <button onClick={handleRegeneratData} className="btn-regenerate">
          Regenerar Dados
        </button>
      </div>

      <div className="content">
        <div className="lightmap-wrapper">
          <div className="lightmap-grid">
            {normalizedData.map(cell => (
              <div
                //key={cell.id}
                className="lightmap-cell"
                style={{ backgroundColor: getColorForValue(cell.normalized) }}
                title={`X, Y, Z\nValor: ${cell.value.toFixed(2)}N`}
              />
            ))}
          </div>
        </div>

        <div className="legend">
          <h3>Legenda</h3>
          <div className="legend-gradient">
            <div
              className="legend-color"
              style={{ backgroundColor: getColorForValue(0) }}
            />
            <div className="legend-labels">
              <span>{MIN_VALUE.toFixed(0)}N</span>
              <span>{maxMetricValue.toFixed(0)}N</span>
            </div>
          </div>
          <div className="legend-description">
            <p>Roxo: Valores baixos</p>
            <p>Laranja: Valores médios</p>
            <p>Amarelo: Valores altos</p>
          </div>
          
          <div className="legend-stats">
            <h4>Estatísticas</h4>
            <p>Total de Células: {lightmapData.length}</p>
            <p>Tamanho da Grade: {height}x{width}</p>
            <p>
              Valor Médio:{' '}
              {(
                lightmapData.reduce((sum, cell) => sum + cell.value, 0) /
                lightmapData.length
              ).toFixed(2)}
              N
            </p>
            <p>
              Valor Mínimo:{' '}
              {Math.min(...lightmapData.map(c => c.value)).toFixed(2)}N
            </p>
            <p>
              Valor Máximo:{' '}
              {Math.max(...lightmapData.map(c => c.value)).toFixed(2)}N
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
