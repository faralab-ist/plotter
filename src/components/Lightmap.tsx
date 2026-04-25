import React, { useMemo, useState, useRef, useEffect } from 'react';
import '../styles/Lightmap.css';

export type LightmapCell_Input = [[number, number, number], number];

export interface LightmapCell {
  value: number;
  x: number;
  y: number;
  z: number;
}

export function formatTooltip(cell: LightmapCell): string {
  return `(${cell.x}, ${cell.y}, ${cell.z}) : ${cell.value.toFixed(2)} V/m`;
}

interface LightmapProps {
  data: LightmapCell_Input[][]
  width?: number
  height?: number
  resolution?: number
  circular?: boolean
}

export function downsample(
  data: LightmapCell_Input[][],
  resolution: number
): LightmapCell[] {
  const clampedResolution =
    !isFinite(resolution) || isNaN(resolution) || resolution <= 0 || resolution > 1
      ? 1
      : resolution;

  const blockSize = Math.ceil(1 / clampedResolution);
  const rows = data.length;
  const cols = data[0]?.length ?? 0;

  const result: LightmapCell[] = [];

  for (let rowStart = 0; rowStart < rows; rowStart += blockSize) {
    for (let colStart = 0; colStart < cols; colStart += blockSize) {
      let sum = 0;
      let count = 0;
      let firstCell: LightmapCell | null = null;

      for (let r = rowStart; r < Math.min(rowStart + blockSize, rows); r++) {
        for (let c = colStart; c < Math.min(colStart + blockSize, cols); c++) {
          const [[x, y, z], value] = data[r][c];
          if (firstCell === null) {
            firstCell = { x, y, z, value };
          }
          sum += value;
          count++;
        }
      }

      if (firstCell !== null && count > 0) {
        result.push({
          x: firstCell.x,
          y: firstCell.y,
          z: firstCell.z,
          value: sum / count,
        });
      }
    }
  }

  return result;
}

export function getColorForValue(normalizedValue: number): string {
  const t = Math.max(0, Math.min(1, normalizedValue));

  let hue: number;
  let saturation: number;
  let lightness: number;

  if (t <= 0.5) {
    // vermelho → preto
    const s = t / 0.5; // s ∈ [0, 1]
    hue = 0;
    saturation = 100 * (1 - s);
    lightness = 50 * (1 - s);
  } else {
    // preto → azul
    const s = (t - 0.5) / 0.5; // s ∈ [0, 1]
    hue = 240;
    saturation = 100 * s;
    lightness = 50 * s;
  }

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function isCellInCircle(
  cellCenterX: number,
  cellCenterY: number,
  circleCenterX: number,
  circleCenterY: number,
  radius: number
): boolean {
  return (
    (cellCenterX - circleCenterX) ** 2 + (cellCenterY - circleCenterY) ** 2 <= radius ** 2
  );
}

export const Lightmap: React.FC<LightmapProps> = ({ data, width = 400, height = 400, resolution = 1, circular = false }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lightmapData = useMemo(() => downsample(data, resolution ?? 1), [data, resolution]);

  const normalizedData = useMemo(() => {
    return lightmapData.map(cell => ({
      ...cell,
      // Normalização fixa sobre intervalo [-100, 100]
      normalized: Math.max(0, Math.min(1, (cell.value + 100) / 200)),
    }));
  }, [lightmapData]);

  const gridWidth = width ?? 400;
  const gridHeight = height ?? 400;

  const clampedRes = (!isFinite(resolution ?? 1) || isNaN(resolution ?? 1) || (resolution ?? 1) <= 0 || (resolution ?? 1) > 1) ? 1 : (resolution ?? 1);
  const blockSize = Math.ceil(1 / clampedRes);
  const rowCount = Math.ceil(data.length / blockSize);
  const columnCount = Math.ceil((data[0]?.length ?? 0) / blockSize);

  // Não usar Math.floor aqui — guardar o valor exato para calcular posições proporcionais
  const cellWidth = useMemo(() => {
    if (columnCount === 0) return 0;
    return gridWidth / columnCount;
  }, [gridWidth, columnCount]);

  const cellHeight = useMemo(() => {
    if (rowCount === 0) return 0;
    return gridHeight / rowCount;
  }, [gridHeight, rowCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const circleCenterX = gridWidth / 2;
    const circleCenterY = gridHeight / 2;
    const radius = Math.min(gridWidth, gridHeight) / 2;

    if (circular) {
      //omite cells fora do circulo
      ctx.save();
      ctx.beginPath();
      ctx.arc(circleCenterX, circleCenterY, radius, 0, Math.PI * 2);
      ctx.clip();
    }

    normalizedData.forEach((cell, index) => {
      const col = index % columnCount;
      const row = Math.floor(index / columnCount);

      // Calcular posição e tamanho com Math.round baseado no índice para evitar
      // gaps de sub-pixel entre células adjacentes
      const x = Math.round(col * gridWidth / columnCount);
      const y = Math.round(row * gridHeight / rowCount);
      const w = Math.round((col + 1) * gridWidth / columnCount) - x;
      const h = Math.round((row + 1) * gridHeight / rowCount) - y;

      ctx.fillStyle = getColorForValue(cell.normalized);
      ctx.fillRect(x, y, w, h);
    });

    if (circular) {
      ctx.restore();
    }
  }, [normalizedData, cellWidth, cellHeight, columnCount, circular, gridWidth, gridHeight]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const colIndex = Math.floor(mouseX / cellWidth);
    const rowIndex = Math.floor(mouseY / cellHeight);
    const cellIndex = rowIndex * columnCount + colIndex;

    if (circular) {
      const centerX = colIndex * cellWidth + cellWidth / 2;
      const centerY = rowIndex * cellHeight + cellHeight / 2;
      const circleCenterX = gridWidth / 2;
      const circleCenterY = gridHeight / 2;
      const radius = Math.min(gridWidth, gridHeight) / 2;
      if (!isCellInCircle(centerX, centerY, circleCenterX, circleCenterY, radius)) {
        setHoveredIndex(null);
        return;
      }
    }

    if (cellIndex >= 0 && cellIndex < normalizedData.length) {
      setHoveredIndex(cellIndex);
      setTooltipPos({ x: e.clientX + 10, y: e.clientY + 10 });
    } else {
      setHoveredIndex(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="lightmap-container">
      <div className="content">
        <div className="lightmap-wrapper">
          <div
            style={{
              borderRadius: circular ? '50%' : undefined,
              overflow: circular ? 'hidden' : undefined,
              display: 'inline-block',
              lineHeight: 0,
            }}
          >
            <canvas
              ref={canvasRef}
              width={gridWidth}
              height={gridHeight}
              style={{ display: 'block', borderRadius: circular ? undefined : '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
            />
          </div>
          {hoveredIndex !== null && normalizedData[hoveredIndex] !== undefined && (
            <div
              className="lightmap-tooltip"
              style={{
                position: 'fixed',
                left: tooltipPos.x,
                top: tooltipPos.y,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            >
              {formatTooltip(normalizedData[hoveredIndex]!)}
            </div>
          )}
        </div>
        <div className="legend">
          <h3>Legend</h3>
          <div className="legend-gradient">
            <div
              className="legend-color"
              style={{
                background: `linear-gradient(to top, ${getColorForValue(0)}, 
                ${getColorForValue(0.25)}, ${getColorForValue(0.5)}, 
                ${getColorForValue(0.75)}, ${getColorForValue(1)})`,
              }}
            />
            <div className="legend-labels">
              <span>100V/m</span>
              <span>-100V/m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
