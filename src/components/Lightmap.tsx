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

export function getColorForValue(rawValue: number): string {
  const normalizedValue = Math.max(-1, Math.min(1, rawValue));
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
    if (!Array.isArray(data) || data.length === 0 || rowCount <= 0) return [] as Array<{ row: number; value: number }>;

    const maxTicks = 7;
    const tickCount = Math.min(maxTicks, rowCount);
    const ticks: Array<{ row: number; value: number }> = [];

    for (let i = 0; i < tickCount; i++) {
      const row = tickCount === 1 ? 0 : Math.round((i * (rowCount - 1)) / (tickCount - 1));
      if (ticks.length > 0 && ticks[ticks.length - 1].row === row) continue;

      const sourceRow = Math.min(row * blockSize, data.length - 1);
      const cell = data[sourceRow]?.[0];
      const yValue = cell && Array.isArray(cell[0]) ? cell[0][1] : undefined;
      if (typeof yValue === 'number' && isFinite(yValue)) {
        ticks.push({ row, value: yValue });
      }
    }

    return ticks.filter(tick => tick.row !== rowCount - 1);
  }, [data, rowCount, blockSize]);

  const xTicks = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0 || columnCount <= 0) return [] as Array<{ col: number; value: number }>;

    const maxTicks = 7;
    const tickCount = Math.min(maxTicks, columnCount);
    const ticks: Array<{ col: number; value: number }> = [];

    for (let i = 0; i < tickCount; i++) {
      const col = tickCount === 1 ? 0 : Math.round((i * (columnCount - 1)) / (tickCount - 1));
      if (ticks.length > 0 && ticks[ticks.length - 1].col === col) continue;

      const sourceCol = Math.min(col * blockSize, (data[0]?.length ?? 0) - 1);
      const cell = data[data.length - 1]?.[sourceCol] ?? data[0]?.[sourceCol];
      const xValue = cell && Array.isArray(cell[0]) ? cell[0][0] : undefined;
      if (typeof xValue === 'number' && isFinite(xValue)) {
        ticks.push({ col, value: xValue });
      }
    }

    return ticks.filter(tick => tick.col !== 0);
  }, [data, columnCount, blockSize]);

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

  const yMinorTickRows = useMemo(() => {
    const majorRows = yTicks.map(tick => tick.row);
    if (majorRows.length === 0) return [];
    const positions = Array.from(new Set([...majorRows, rowCount - 1])).sort((a, b) => a - b);
    return buildMinorTicks(positions, 5);
  }, [yTicks, rowCount]);
  const xMinorTickCols = useMemo(() => {
    const majorCols = xTicks.map(tick => tick.col);
    if (majorCols.length === 0) return [];
    const positions = Array.from(new Set([0, ...majorCols])).sort((a, b) => a - b);
    return buildMinorTicks(positions, 5);
  }, [xTicks]);

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
      //omite cells fora do circulo
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

      let fillColor: string;
      if (legendHoveredValue !== null) {
        const normalizedHover = useModule
          ? normalizeToModuleScale(legendHoveredValue)
          : normalizeToColorScale(legendHoveredValue);
        const diff = Math.abs(normalizedValue - normalizedHover);
        fillColor = diff <= effectiveThreshold * 2
          ? getColorForValue(normalizedValue)
          : '#000000';
      } else {
        fillColor = getColorForValue(normalizedValue);
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w, h);
    });

    // Highlight da célula hovered — overlay branco semi-transparente (só quando não está em legend hover mode)
    if (hoveredIndex !== null && legendHoveredValue === null) {
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
  }, [lightmapData, cellWidth, cellHeight, columnCount, circular, gridWidth, gridHeight, useModule, hoveredIndex, legendHoveredValue, effectiveThreshold]);

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
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const hoverValue = calculateHoverValue(relativeY, colorRange);
    if (legendRafRef.current !== null) {
      cancelAnimationFrame(legendRafRef.current);
    }
    legendRafRef.current = requestAnimationFrame(() => {
      setLegendHoveredValue(hoverValue);
      legendRafRef.current = null;
    });
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
                {yTicks.map((tick) => (
                  <div
                    key={`${tick.row}-${tick.value}`}
                    className="lightmap-y-tick"
                    style={{ top: `${rowCount > 1 ? (tick.row / (rowCount - 1)) * 100 : 0}%` }}
                  >
                    <span className="lightmap-y-tick-label">{formatAxisValue(tick.value)}</span>
                    <span className="lightmap-y-tick-line" />
                  </div>
                ))}
                {yMinorTickRows.map((row, index) => (
                  <div
                    key={`y-minor-${row}-${index}`}
                    className="lightmap-y-minor-tick"
                    style={{ top: `${rowCount > 1 ? (row / (rowCount - 1)) * 100 : 0}%` }}
                  >
                    <span className="lightmap-y-minor-tick-line" />
                  </div>
                ))}
              </div>
            )}
            {showXTicks && xTicks.length > 0 && (
              <div className="lightmap-x-ticks" aria-hidden="true">
                {xTicks.map((tick) => (
                  <div
                    key={`${tick.col}-${tick.value}`}
                    className="lightmap-x-tick"
                    style={{ left: `${columnCount > 1 ? (tick.col / (columnCount - 1)) * 100 : 0}%` }}
                  >
                    <span className="lightmap-x-tick-label">{formatAxisValue(tick.value)}</span>
                    <span className="lightmap-x-tick-line" />
                  </div>
                ))}
                {xMinorTickCols.map((col, index) => (
                  <div
                    key={`x-minor-${col}-${index}`}
                    className="lightmap-x-minor-tick"
                    style={{ left: `${columnCount > 1 ? (col / (columnCount - 1)) * 100 : 0}%` }}
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
                const value = colorRange.max - t * (colorRange.max - colorRange.min);
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
            </div>
            <div
              className="legend-color"
              style={{
                position: 'relative',
                background: `linear-gradient(to top, ${getColorForValue(-1)}, 
                ${getColorForValue(-0.5)}, ${getColorForValue(0)}, 
                ${getColorForValue(0.5)}, ${getColorForValue(1)})`,
                cursor: 'crosshair',
              }}
              onMouseMove={handleLegendMouseMove}
              onMouseLeave={handleLegendMouseLeave}
            >
              {legendHoveredValue !== null && (
                <LegendIndicator
                  relativeY={
                    colorRange.max !== colorRange.min
                      ? (colorRange.max - legendHoveredValue) / (colorRange.max - colorRange.min)
                      : 0
                  }
                  value={legendHoveredValue}
                />
              )}
            </div>
            <div className="legend-labels">
              <span>1</span>
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
        </div>
      </div>
    </div>
  );
};
