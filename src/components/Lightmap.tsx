import React, { useMemo, useState, useCallback } from 'react';
import '../styles/Lightmap.css';

export type LightmapCell_Input = [[number, number, number], number];

export interface LightmapCell {
  value: number;
  x: number;
  y: number;
  z: number;
}

interface LightmapCellItemProps {
  color: string;
  cellWidth: number;
  cellHeight: number;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const LightmapCellItem = React.memo<LightmapCellItemProps>(({ 
  color, 
  cellWidth, 
  cellHeight, 
  onMouseEnter, 
  onMouseMove, 
  onMouseLeave 
}) => {
  return (
    <div
      className="lightmap-cell"
      style={{
        width: `${cellWidth}px`,
        height: `${cellHeight}px`,
        backgroundColor: color,
      }}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    />
  );
});

export function formatTooltip(cell: LightmapCell): string {
  return `(${cell.x}, ${cell.y}, ${cell.z}) : ${cell.value.toFixed(2)}N`;
}

interface LightmapProps {
  data: LightmapCell_Input[][]
  width?: number
  height?: number
  resolution?: number
  baseHue?: number
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

export function getColorForValue(normalizedValue: number, baseHue: number): string {
  const hue0 = ((baseHue % 360) + 360) % 360;

  const t = Math.max(0, Math.min(1, normalizedValue));

  const hue1 = (hue0 + 30) % 360;
  const hue2 = (hue0 + 60) % 360;

  let hue: number;
  let saturation: number;
  let lightness: number;

  if (t <= 0.5) {
    const s = t / 0.5; // s in [0, 1]
    hue = hue0 + (hue1 - hue0) * s;
    saturation = 60 + (90 - 60) * s;
    lightness = 20 + (40 - 20) * s;
  } else {
    const s = (t - 0.5) / 0.5; // s in [0, 1]
    hue = hue1 + (hue2 - hue1) * s;
    saturation = 90 + (100 - 90) * s;
    lightness = 40 + (55 - 40) * s;
  }

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export const Lightmap: React.FC<LightmapProps> = ({ data, width, height, resolution, baseHue = 286 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const lightmapData = useMemo(() => downsample(data, resolution ?? 1), [data, resolution]);

  const effectiveMax = useMemo(() => {
    if (lightmapData.length === 0) return 0;
    return Math.max(...lightmapData.map(cell => cell.value));
  }, [lightmapData]);

  const effectiveMin = useMemo(() => {
    if (lightmapData.length === 0) return 0;
    return Math.min(...lightmapData.map(cell => cell.value));
  }, [lightmapData]);

  const normalizedData = useMemo(() => {
    const range = effectiveMax - effectiveMin || 1;

    return lightmapData.map(cell => ({
      ...cell,
      normalized: (cell.value - effectiveMin) / range,
    }));
  }, [lightmapData, effectiveMax, effectiveMin]);

  const gridWidth = width ?? 400;
  const gridHeight = height ?? 400;
  const GAP_SIZE = 0;

  const clampedRes = (!isFinite(resolution ?? 1) || isNaN(resolution ?? 1) || (resolution ?? 1) <= 0 || (resolution ?? 1) > 1) ? 1 : (resolution ?? 1);
  const blockSize = Math.ceil(1 / clampedRes);
  const rowCount = Math.ceil(data.length / blockSize);
  const columnCount = Math.ceil((data[0]?.length ?? 0) / blockSize);

  const cellWidth = useMemo(() => {
    if (columnCount === 0) return 0;
    return Math.floor(gridWidth / columnCount);
  }, [gridWidth, columnCount]);

  const cellHeight = useMemo(() => {
    if (rowCount === 0) return 0;
    return Math.floor(gridHeight / rowCount);
  }, [gridHeight, rowCount]);

  const gridStyle = useMemo(
    () => ({
      width: gridWidth,
      height: gridHeight,
      gridTemplateColumns: `repeat(${columnCount}, ${cellWidth}px)`,
      gridTemplateRows: `repeat(${rowCount}, ${cellHeight}px)`,
      gap: `${GAP_SIZE}px`,
      justifyContent: 'center' as const,
      alignContent: 'center' as const,
    }),
    [gridWidth, gridHeight, columnCount, rowCount, cellWidth, cellHeight]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX + 10, y: e.clientY + 10 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  return (
    <div className="lightmap-container">
      <div className="content">
        <div className="lightmap-wrapper">
          <div className="lightmap-grid" style={gridStyle}>
            {normalizedData.map((cell, index) => {
              const handleMouseEnter = (e: React.MouseEvent) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setTooltipPos({ x: rect.left, y: rect.top });
                setHoveredIndex(index);
              };

              return (
                <LightmapCellItem
                  key={`${cell.x}-${cell.y}-${cell.z}`}
                  color={getColorForValue(cell.normalized, baseHue)}
                  cellWidth={cellWidth}
                  cellHeight={cellHeight}
                  onMouseEnter={handleMouseEnter}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              );
            })}
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
                borderRadius: '4px',
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
          <h3>Legenda</h3>
          <div className="legend-gradient">
            <div
              className="legend-color"
              style={{
                background: `linear-gradient(to top, ${getColorForValue(0, baseHue)}, ${getColorForValue(0.25, baseHue)}, ${getColorForValue(0.5, baseHue)}, ${getColorForValue(0.75, baseHue)}, ${getColorForValue(1, baseHue)})`,
              }}
            />
            <div className="legend-labels">
              <span>{effectiveMax.toFixed(0)}N</span>
              <span>{effectiveMin.toFixed(0)}N</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
