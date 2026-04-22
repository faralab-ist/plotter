import React from 'react';
import './Lightmap.css';

export type LightmapPoint = [[number, number, number], number];
export type LightmapMatrix = LightmapPoint[][];

const LIGHTMAP_FIXED_MIN_VALUE = -100;
const LIGHTMAP_FIXED_MAX_VALUE = 100;

interface LightmapCell {
  value: number;
  x: number;
  y: number;
  z: number;
}

export interface LightmapProps {
  data: LightmapMatrix;
  width: number;
  height: number;
}

export const Lightmap: React.FC<LightmapProps> = ({ data }) => {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [hoveredCell, setHoveredCell] = React.useState<{
    x: number;
    y: number;
    z: number;
    value: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  const lightmapData = React.useMemo((): LightmapCell[] => {
    const cells: LightmapCell[] = [];

    for (let row = 0; row < data.length; row += 1) {
      for (let col = 0; col < data[row].length; col += 1) {
        const [[x, y, z], value] = data[row][col];
        cells.push({ value, x, y, z });
      }
    }

    return cells;
  }, [data]);

  const effectiveMaxValue = LIGHTMAP_FIXED_MAX_VALUE;
  const effectiveMinValue = LIGHTMAP_FIXED_MIN_VALUE;

  const normalizedData = React.useMemo(() => {
    const range = effectiveMaxValue - effectiveMinValue || 1;

    return lightmapData.map((cell) => ({
      ...cell,
      normalized: Math.max(
        0,
        Math.min(1, (cell.value - effectiveMinValue) / range),
      ),
    }));
  }, [effectiveMaxValue, effectiveMinValue, lightmapData]);

  const rowCount = data.length;
  const columnCount = data[0]?.length ?? 0;
  const gridSize = 220;
  const gapSize = 0;

  const cellSize = React.useMemo(() => {
    if (rowCount === 0 || columnCount === 0) {
      return 0;
    }

    const availableWidth = gridSize - Math.max(0, columnCount - 1) * gapSize;
    const availableHeight = gridSize - Math.max(0, rowCount - 1) * gapSize;

    return Math.max(
      1,
      Math.floor(Math.min(availableWidth / columnCount, availableHeight / rowCount)),
    );
  }, [columnCount, rowCount]);

  const gridStyle = React.useMemo(
    () => ({
      gridTemplateColumns: `repeat(${columnCount}, ${cellSize}px)`,
      gap: `${gapSize}px`,
      justifyContent: 'center' as const,
      alignContent: 'center' as const,
    }),
    [cellSize, columnCount],
  );

  const cellStyle = React.useMemo(
    () => ({
      width: `${cellSize}px`,
      height: `${cellSize}px`,
    }),
    [cellSize],
  );

  const getColorForValue = (normalizedValue: number): string => {
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    const red = { r: 239, g: 68, b: 68 };
    const black = { r: 0, g: 0, b: 0 };
    const blue = { r: 59, g: 130, b: 246 };

    const interpolateChannel = (start: number, end: number, t: number): number =>
      Math.round(start + (end - start) * t);

    const mixColors = (
      start: { r: number; g: number; b: number },
      end: { r: number; g: number; b: number },
      t: number,
    ): string =>
      `rgb(${interpolateChannel(start.r, end.r, t)}, ${interpolateChannel(start.g, end.g, t)}, ${interpolateChannel(start.b, end.b, t)})`;

    if (clampedValue <= 0.5) {
      return mixColors(red, black, clampedValue / 0.5);
    }

    return mixColors(black, blue, (clampedValue - 0.5) / 0.5);
  };

  return (
    <div className="plotter-lightmap-container">
      <div className="plotter-lightmap-content">
        <div className="plotter-lightmap-wrapper">
          <div ref={wrapperRef} className="plotter-lightmap-grid" style={gridStyle}>
            {normalizedData.map((cell) => (
              <div
                key={`${cell.x}-${cell.y}-${cell.z}`}
                className="plotter-lightmap-cell"
                style={{
                  ...cellStyle,
                  backgroundColor: getColorForValue(cell.normalized),
                }}
                onMouseEnter={(event) => {
                  const wrapperRect = wrapperRef.current?.getBoundingClientRect();
                  if (wrapperRect) {
                    setTooltipPos({
                      x: event.clientX - wrapperRect.left + 10,
                      y: event.clientY - wrapperRect.top + 10,
                    });
                  }
                  setHoveredCell({
                    x: cell.x,
                    y: cell.y,
                    z: cell.z,
                    value: cell.value,
                  });
                }}
                onMouseMove={(event) => {
                  const wrapperRect = wrapperRef.current?.getBoundingClientRect();
                  if (wrapperRect) {
                    setTooltipPos({
                      x: event.clientX - wrapperRect.left + 10,
                      y: event.clientY - wrapperRect.top + 10,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredCell(null)}
              />
            ))}
          </div>

          {hoveredCell ? (
            <div
              style={{
                position: 'absolute',
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
              ({hoveredCell.x.toFixed(2)}, {hoveredCell.y.toFixed(2)}, {hoveredCell.z.toFixed(2)}) :{' '}
              {hoveredCell.value.toFixed(2)}V
            </div>
          ) : null}
        </div>

        <div className="plotter-lightmap-legend">
          <div className="plotter-lightmap-legend-gradient">
            <div className="plotter-lightmap-legend-color" />
            <div className="plotter-lightmap-legend-labels">
              <span>{effectiveMaxValue.toFixed(0)}V</span>
              <span>{effectiveMinValue.toFixed(0)}V</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
