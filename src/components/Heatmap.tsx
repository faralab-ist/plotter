import React, { useState, useMemo } from 'react';
import '../styles/Heatmap.css';

interface HeatmapCell {
  id: number;
  value: number;
  row: number;
  col: number;
}

const GRID_SIZE = 2;
const MIN_VALUE = 1;
const MAX_VALUE = 500;

export const Heatmap: React.FC = () => {
  const [maxMetricValue, setMaxMetricValue] = useState<number>(MAX_VALUE);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>(() =>
    generateHeatmapData()
  );

  function generateHeatmapData(): HeatmapCell[] {
    const data: HeatmapCell[] = [];
    let id = 0;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const value = Math.random() * (MAX_VALUE - MIN_VALUE) + MIN_VALUE;
        data.push({
          id: id++,
          value,
          row,
          col,
        });
      }
    }

    return data;
  }

  const normalizedData = useMemo(() => {
    return heatmapData.map(cell => ({
      ...cell,
      normalized: (cell.value - MIN_VALUE) / (maxMetricValue - MIN_VALUE),
    }));
  }, [heatmapData, maxMetricValue]);

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
    setHeatmapData(generateHeatmapData());
  };

  const handleMaxMetricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (value >= MIN_VALUE) {
      setMaxMetricValue(value);
    }
  };

  return (
    <div className="heatmap-container">
      <h1>Visualizador de Heatmap</h1>

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
        <div className="heatmap-wrapper">
          <div className="heatmap-grid">
            {normalizedData.map(cell => (
              <div
                key={cell.id}
                className="heatmap-cell"
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
            <p>Total de Células: {heatmapData.length}</p>
            <p>Tamanho da Grade: {GRID_SIZE}x{GRID_SIZE}</p>
            <p>
              Valor Médio:{' '}
              {(
                heatmapData.reduce((sum, cell) => sum + cell.value, 0) /
                heatmapData.length
              ).toFixed(2)}
              N
            </p>
            <p>
              Valor Mínimo:{' '}
              {Math.min(...heatmapData.map(c => c.value)).toFixed(2)}N
            </p>
            <p>
              Valor Máximo:{' '}
              {Math.max(...heatmapData.map(c => c.value)).toFixed(2)}N
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
