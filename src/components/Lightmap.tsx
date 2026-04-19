import React, { useEffect, useMemo, useState } from 'react';
import '../styles/Lightmap.css';

interface LightmapCell {
  value: number;
  x: number;
  y: number;
  //z: number;
}

interface LightmapProps {
  data: Array<Array<[[number, number], number]>>
  width: number
  height: number
}

const MAX_VALUE = 500; // Valor máximo padrão para normalização
const MIN_VALUE = 0;   // Valor mínimo para normalização

export const Lightmap: React.FC<LightmapProps> = ({ data }) => {
  const [maxMetricValue, setMaxMetricValue] = useState<number>(MAX_VALUE);

  const lightmapData = useMemo((): LightmapCell[] => {
    const cells: LightmapCell[] = [];

    for (let row = 0; row < data.length; row++) {
      for (let col = 0; col < data[row].length; col++) {
        const [[x, y], value] = data[row][col];
        cells.push({ value, x, y });
      }
    }

    return cells;
  }, [data]);

  const normalizedData = useMemo(() => {
    const range = maxMetricValue - MIN_VALUE || 1;

    return lightmapData.map(cell => ({
      ...cell,
      normalized: (cell.value - MIN_VALUE) / range,
    }));
  }, [lightmapData, maxMetricValue]);

  const rowCount = data.length;
  const columnCount = data[0]?.length ?? 0;
  const GRID_SIZE = 400;
  const GAP_SIZE = 4;

  const cellSize = useMemo(() => {
    if (rowCount === 0 || columnCount === 0) return 0;

    const availableWidth = GRID_SIZE - Math.max(0, columnCount - 1) * GAP_SIZE;
    const availableHeight = GRID_SIZE - Math.max(0, rowCount - 1) * GAP_SIZE;

    return Math.max(1, Math.floor(Math.min(availableWidth / columnCount, availableHeight / rowCount)));
  }, [rowCount, columnCount]);


  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${columnCount}, ${cellSize}px)`,
      gap: `${GAP_SIZE}px`,
      justifyContent: 'center' as const,
      alignContent: 'center' as const,
    }),
    [columnCount, cellSize]
  );

  const cellStyle = useMemo(
    () => ({
      width: `${cellSize}px`,
      height: `${cellSize}px`,
    }),
    [cellSize]
  );


  const effectiveMaxValue = useMemo(() => {
    if (lightmapData.length === 0) return MAX_VALUE;
    return Math.max(...lightmapData.map(cell => cell.value));
  }, [lightmapData]);

  useEffect(() => {
    setMaxMetricValue(effectiveMaxValue);
  }, [effectiveMaxValue]);


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

  return (
    <div className="lightmap-container">
      <div className="content">
        <div className="lightmap-wrapper">
          <div className="lightmap-grid" style={gridStyle}>
            {normalizedData.map(cell => (
              <div
                key={`${cell.x}-${cell.y}`}
                className="lightmap-cell"
                style={{
                  ...cellStyle,
                  backgroundColor: getColorForValue(cell.normalized),
                }}
                title={`(${cell.x}, ${cell.y})\nValue: ${cell.value.toFixed(2)}N`}
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
        </div>
      </div>
    </div>
  );
};
