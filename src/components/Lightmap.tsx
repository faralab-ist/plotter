import React, { useMemo, useState, useRef, useEffect } from 'react';
import '../styles/Lightmap.css';
import { AxisReference } from './AxisReference';

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
  showAxis?: boolean
  showYTicks?: boolean
  showXTicks?: boolean
  normalizationMin?: number
  normalizationMax?: number
  legendHoverThreshold?: number
}

export function downsample(
  data: LightmapCell_Input[][],
  resolution: number
): LightmapCell[] {
  const clampedResolution =
    !isFinite(resolution) || isNaN(resolution) || resolution <= 0 || resolution > 1
      ? 1
      : resolution;

  if (clampedResolution === 1) {
    return data.flatMap(row =>
      row.map(([[x, y, z], value]) => ({ x, y, z, value }))
    );
  }

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

export function getColorForValue(rawValue: number, useModule: boolean = false): string {
  const normalizedValue = Math.max(-1, Math.min(1, rawValue));
  
  if (useModule) {
    // Modo módulo: apenas preto -> vermelho (0 a 1)
    const absValue = Math.abs(normalizedValue);
    const hue = 0;
    const saturation = 100 * absValue;
    const lightness = 50 * absValue;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  
  // Modo padrão: azul -> preto -> vermelho
  const t = (normalizedValue + 1) / 2;

  let hue: number;
  let saturation: number;
  let lightness: number;

  if (t <= 0.5) {
    // azul -> preto  (valores negativos)
    const s = t / 0.5;
    hue = 240;
    saturation = 100 * (1 - s);
    lightness = 50 * (1 - s);
  } else {
    // preto -> vermelho  (valores positivos)
    const s = (t - 0.5) / 0.5;
    hue = 0;
    saturation = 100 * s;
    lightness = 50 * s;
  }

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function calculateHoverValue(
  relativeY: number,
  colorRange: { min: number; max: number }
): number {
  const { min, max } = colorRange;
  if (max === min) return min;
  return max - relativeY * (max - min);
}

export function sanitizeThreshold(value: unknown): number {
  if (
    value === undefined ||
    value === null ||
    typeof value !== 'number' ||
    !isFinite(value) ||
    isNaN(value) ||
    value <= 0
  ) {
    return 0.05;
  }
  return value;
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

interface LegendIndicatorProps {
  relativeY: number;
  value: number;
}

const LegendIndicator: React.FC<LegendIndicatorProps> = ({ relativeY, value }) => {
  const label = Math.abs(value) >= 1000
    ? (value / 1000).toFixed(1) + 'k'
    : value.toFixed(2);

  return (
    <div
      style={{
        position: 'absolute',
        top: `${relativeY * 100}%`,
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '2px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 0 2px rgba(0,0,0,0.8)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: '105%',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '0.7rem',
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          color: '#fff',
          backgroundColor: 'rgba(0,0,0,0.75)',
          padding: '1px 4px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
        }}
      >
        {label} V/m
      </span>
    </div>
  );
};

export const Lightmap: React.FC<LightmapProps> = ({
  data,
  width = 400,
  height = 400,
  resolution = 1,
  circular = false,
  showAxis = true,
  showYTicks = true,
  showXTicks = true,
  normalizationMin,
  normalizationMax,
  legendHoverThreshold,
}) => {
  const [useModule, setUseModule] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [legendHoveredValue, setLegendHoveredValue] = useState<number | null>(null);
  const [legendPinnedValue, setLegendPinnedValue] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const legendRafRef = useRef<number | null>(null);

  const effectiveThreshold = useMemo(() => sanitizeThreshold(legendHoverThreshold), [legendHoverThreshold]);

  const lightmapData = useMemo(() => downsample(data, resolution ?? 1), [data, resolution]);

  const gridWidth = width ?? 400;
  const gridHeight = height ?? 400;

  const clampedRes = (!isFinite(resolution ?? 1) || isNaN(resolution ?? 1) || (resolution ?? 1) <= 0 || (resolution ?? 1) > 1) ? 1 : (resolution ?? 1);
  const blockSize = Math.ceil(1 / clampedRes);
  const rowCount = Math.ceil(data.length / blockSize);
  const columnCount = Math.ceil((data[0]?.length ?? 0) / blockSize);

  const yTicks = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [] as Array<{ position: number; value: number }>;
    }

    const sourceRowCount = data.length;
    const ticks: Array<{ position: number; value: number }> = [];
    
    // Posições fixas: 0, 0.25, 0.5, 0.75, 1 (alinhadas com as células do grid)
    const positions = [0, 0.25, 0.5, 0.75, 1];

    for (const t of positions) {
      // Para um grid 100x100 (índices 0-99), usar sourceRowCount - 1
      const row = Math.round(t * (sourceRowCount - 1));
      
      const cell = data[row]?.[0];
      const yValue = cell && Array.isArray(cell[0]) ? cell[0][0] : undefined;
      if (typeof yValue === 'number' && isFinite(yValue)) {
        ticks.push({ position: t, value: yValue });
      }
    }

    return ticks;
  }, [data]);

  const xTicks = useMemo(() => {
    const sourceColCount = data[0]?.length ?? 0;
    if (!Array.isArray(data) || data.length === 0 || sourceColCount <= 0) {
      return [] as Array<{ position: number; value: number }>;
    }

    const ticks: Array<{ position: number; value: number }> = [];
    
    // Posições fixas: 0, 0.25, 0.5, 0.75, 1 (alinhadas com as células do grid)
    const positions = [0, 0.25, 0.5, 0.75, 1];

    for (const t of positions) {
      // Para um grid 100x100 (índices 0-99), usar sourceColCount - 1
      const col = Math.round(t * (sourceColCount - 1));

      const cell = data[data.length - 1]?.[col] ?? data[0]?.[col];
      const xValue = cell && Array.isArray(cell[0]) ? cell[0][1] : undefined;
      if (typeof xValue === 'number' && isFinite(xValue)) {
        ticks.push({ position: t, value: xValue });
      }
    }

    return ticks;
  }, [data]);

  const buildMinorTicks = (positions: number[], count: number): number[] => {
    if (positions.length < 2 || count <= 0) return [];
    const minors: number[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i];
      const end = positions[i + 1];
      const step = (end - start) / (count + 1);
      for (let j = 1; j <= count; j++) {
        minors.push(start + step * j);
      }
    }
    return minors;
  };


  const formatAxisValue = (value: number): string => {
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  };

  const cellWidth = useMemo(() => {
    if (columnCount === 0) return 0;
    return gridWidth / columnCount;
  }, [gridWidth, columnCount]);

  const cellHeight = useMemo(() => {
    if (rowCount === 0) return 0;
    return gridHeight / rowCount;
  }, [gridHeight, rowCount]);

  const yMinorTickPositions = useMemo(() => {
    if (yTicks.length < 2 || rowCount === 0) return [] as number[];
    const majorPositions = yTicks.map(t => t.position);
    return buildMinorTicks(majorPositions, 4);
  }, [yTicks, rowCount]);

  const xMinorTickPositions = useMemo(() => {
    if (xTicks.length < 2 || columnCount === 0) return [] as number[];
    const majorPositions = xTicks.map(t => t.position);
    return buildMinorTicks(majorPositions, 4);
  }, [xTicks, columnCount]);

  const colorRange = useMemo(() => {
    if (lightmapData.length === 0) {
      return { min: -1, max: 1 };
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const cell of lightmapData) {
      if (cell.value < min) min = cell.value;
      if (cell.value > max) max = cell.value;
    }

    if (isFinite(normalizationMin ?? NaN)) {
      min = normalizationMin as number;
    }

    if (isFinite(normalizationMax ?? NaN)) {
      max = normalizationMax as number;
    }

    if (!isFinite(min) || !isFinite(max) || min === max) {
      return { min: -1, max: 1 };
    }

    return { min, max };
  }, [lightmapData, normalizationMin, normalizationMax]);

  const legendRange = useMemo(() => {
    if (useModule) {
      const absMax = Math.max(Math.abs(colorRange.min), Math.abs(colorRange.max));
      return { min: 0, max: absMax };
    }
    return colorRange;
  }, [colorRange, useModule]);

  const normalizeToColorScale = (value: number): number => {
    const { min, max } = colorRange;
    const normalized = ((value - min) / (max - min)) * 2 - 1;
    return Math.max(-1, Math.min(1, normalized));
  };

  const normalizeToModuleScale = (value: number): number => {
    const { min, max } = colorRange;
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    if (!isFinite(absMax) || absMax === 0) return 0;
    const normalized = Math.abs(value) / absMax;
    return Math.max(0, Math.min(1, normalized));
  };

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
      ctx.save();
      ctx.beginPath();
      ctx.arc(circleCenterX, circleCenterY, radius, 0, Math.PI * 2);
      ctx.clip();
    }

    lightmapData.forEach((cell, index) => {
      const col = index % columnCount;
      const row = Math.floor(index / columnCount);

      const x = Math.round(col * gridWidth / columnCount);
      const y = Math.round(row * gridHeight / rowCount);
      const w = Math.round((col + 1) * gridWidth / columnCount) - x;
      const h = Math.round((row + 1) * gridHeight / rowCount) - y;

      const normalizedValue = useModule
        ? normalizeToModuleScale(cell.value)
        : normalizeToColorScale(cell.value);

      const activeLegendValue = legendPinnedValue ?? legendHoveredValue;

      let fillColor: string;
      if (activeLegendValue !== null) {
        const normalizedHover = useModule
          ? normalizeToModuleScale(activeLegendValue)
          : normalizeToColorScale(activeLegendValue);
        const diff = Math.abs(normalizedValue - normalizedHover);
        fillColor = diff <= effectiveThreshold * 2
          ? getColorForValue(normalizedValue, useModule)
          : '#000000';
      } else {
        fillColor = getColorForValue(normalizedValue, useModule);
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w, h);
    });

    if (hoveredIndex !== null && (legendPinnedValue ?? legendHoveredValue) === null) {
      const col = hoveredIndex % columnCount;
      const row = Math.floor(hoveredIndex / columnCount);
      const x = Math.round(col * gridWidth / columnCount);
      const y = Math.round(row * gridHeight / rowCount);
      const w = Math.round((col + 1) * gridWidth / columnCount) - x;
      const h = Math.round((row + 1) * gridHeight / rowCount) - y;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(x, y, w, h);
    }

    if (circular) {
      ctx.restore();
    }
  }, [lightmapData, cellWidth, cellHeight, columnCount, circular, gridWidth, gridHeight, useModule, hoveredIndex, legendHoveredValue, legendPinnedValue, effectiveThreshold]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX < 0 || mouseY < 0 || mouseX >= rect.width || mouseY >= rect.height) {
      setHoveredIndex(null);
      return;
    }

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

    if (cellIndex >= 0 && cellIndex < lightmapData.length) {
      setHoveredIndex(cellIndex);
      setTooltipPos({ x: e.clientX + 10, y: e.clientY + 10 });
    } else {
      setHoveredIndex(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredIndex(null);
  };

  const handleLegendMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (legendPinnedValue !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const hoverValue = calculateHoverValue(relativeY, legendRange);
    if (legendRafRef.current !== null) {
      cancelAnimationFrame(legendRafRef.current);
    }
    legendRafRef.current = requestAnimationFrame(() => {
      setLegendHoveredValue(hoverValue);
      legendRafRef.current = null;
    });
  };

  const handleLegendClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const clickedValue = calculateHoverValue(relativeY, legendRange);
    setLegendHoveredValue(clickedValue);
    setLegendPinnedValue(clickedValue);
  };

  const handleStopHovering = () => {
    setLegendPinnedValue(null);
    setLegendHoveredValue(null);
  };

  const handleLegendMouseLeave = () => {
    if (legendRafRef.current !== null) {
      cancelAnimationFrame(legendRafRef.current);
      legendRafRef.current = null;
    }
    setLegendHoveredValue(null);
  };

  return (
    <div className="lightmap-container">
      <div className="content">
        <div className="lightmap-wrapper">
          <div className="lightmap-canvas-frame">
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
            {showYTicks && yTicks.length > 0 && (
              <div className="lightmap-y-ticks" aria-hidden="true">
                {yTicks.map((tick) => {
                  // Posição invertida: 0 no topo (valor alto), 1 no fundo (valor baixo)
                  const topPx = (1 - tick.position) * gridHeight;
                  return (
                    <div
                      key={`${tick.position}-${tick.value}`}
                      className="lightmap-y-tick"
                      style={{ top: `${topPx}px` }}
                    >
                      <span className="lightmap-y-tick-label">{formatAxisValue(tick.value)}</span>
                      <span className="lightmap-y-tick-line" />
                    </div>
                  );
                })}
                {yMinorTickPositions.map((position, index) => {
                  const topPx = (1 - position) * gridHeight;
                  return (
                    <div
                      key={`y-minor-${position}-${index}`}
                      className="lightmap-y-minor-tick"
                      style={{ top: `${topPx}px` }}
                    >
                      <span className="lightmap-y-minor-tick-line" />
                    </div>
                  );
                })}
              </div>
            )}
            {showXTicks && xTicks.length > 0 && (
              <div className="lightmap-x-ticks" aria-hidden="true">
                {xTicks.map((tick) => {
                  // Posição direta: 0 à esquerda, 1 à direita
                  const leftPx = tick.position * gridWidth;
                  return (
                    <div
                      key={`${tick.position}-${tick.value}`}
                      className="lightmap-x-tick"
                      style={{ left: `${leftPx}px` }}
                    >
                      <span className="lightmap-x-tick-label">{formatAxisValue(tick.value)}</span>
                      <span className="lightmap-x-tick-line" />
                    </div>
                  );
                })}
                {xMinorTickPositions.map((position, index) => (
                  <div
                    key={`x-minor-${position}-${index}`}
                    className="lightmap-x-minor-tick"
                    style={{ left: `${position * gridWidth}px` }}
                  >
                    <span className="lightmap-x-minor-tick-line" />
                  </div>
                ))}
              </div>
            )}
            {showAxis ? (
              <AxisReference
                data={data}
                style={{ color: '#f5f5f5', thickness: 2, gap: 14, length: 55 }}
              />
            ) : (
              <>
                <div className="lightmap-axis lightmap-axis-x" aria-hidden="true" />
                <div className="lightmap-axis lightmap-axis-y" aria-hidden="true" />
              </>
            )}
          </div>
          {hoveredIndex !== null && lightmapData[hoveredIndex] !== undefined && (
            <div
              className="lightmap-tooltip"
              style={{
                position: 'fixed',
                left: tooltipPos.x,
                top: tooltipPos.y,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            >
              {formatTooltip(lightmapData[hoveredIndex]!)}
            </div>
          )}
        </div>
        <div className="legend" style={{ '--legend-height': `${gridHeight}px` } as React.CSSProperties}>
          <h3>Legend</h3>
          <div className="legend-gradient">
            <div className="legend-scale">
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const value = legendRange.max - t * (legendRange.max - legendRange.min);
                const label = Math.abs(value) >= 1000
                  ? (value / 1000).toFixed(1) + 'k'
                  : Math.abs(value) >= 10
                    ? value.toFixed(1)
                    : value.toFixed(2);
                return (
                  <span
                    key={t}
                    className="legend-scale-tick"
                    style={{ top: `${t * 100}%` }}
                  >
                    {label}
                  </span>
                );
              })}
              {/* Adicionar tick para o valor 0.00 se estiver no range e não for modo módulo */}
              {!useModule && legendRange.min < 0 && legendRange.max > 0 && (() => {
                const zeroT = (legendRange.max - 0) / (legendRange.max - legendRange.min);
                if (zeroT > 0 && zeroT < 1) {
                  return (
                    <span
                      key="zero"
                      className="legend-scale-tick"
                      style={{ 
                        top: `${zeroT * 100}%`,
                        fontWeight: 'bold'
                      }}
                    >
                      0.00
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <div
              className="legend-color"
              style={{
                position: 'relative',
                background: useModule
                  ? `linear-gradient(to top, ${getColorForValue(0, true)}, 
                    ${getColorForValue(0.5, true)}, ${getColorForValue(1, true)})`
                  : `linear-gradient(to top, ${getColorForValue(-1, false)}, 
                    ${getColorForValue(-0.5, false)}, ${getColorForValue(0, false)}, 
                    ${getColorForValue(0.5, false)}, ${getColorForValue(1, false)})`,
                cursor: 'crosshair',
              }}
              onMouseMove={handleLegendMouseMove}
              onMouseLeave={handleLegendMouseLeave}
              onClick={handleLegendClick}
            >
              {(legendPinnedValue ?? legendHoveredValue) !== null && (
                <LegendIndicator
                  relativeY={
                    legendRange.max !== legendRange.min
                      ? (legendRange.max - (legendPinnedValue ?? legendHoveredValue)!) / (legendRange.max - legendRange.min)
                      : 0
                  }
                  value={(legendPinnedValue ?? legendHoveredValue)!}
                />
              )}
            </div>
            <div className="legend-labels">
              <span>{useModule ? 'max' : '1'}</span>
              <span>{useModule ? '0' : '-1'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseModule(prev => !prev)}
            style={{ marginTop: '8px' }}
          >
            {useModule ? 'default' : 'module'}
          </button>
          <button
            type="button"
            onClick={handleStopHovering}
            disabled={legendPinnedValue === null}
            style={{ marginTop: '8px' }}
          >
            stop hovering
          </button>
        </div>
      </div>
    </div>
  );
};
