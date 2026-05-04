import React from 'react'
import '../styles/AxisReference.css'
import type { LightmapCell_Input } from './Lightmap'


export interface Point3D {
  x: number
  y: number
  z: number
}

export interface AxisStyle {
  color?: string
  thickness?: number   
  arrowSize?: number  
  labelFontSize?: number 
  length?: number     
  gap?: number            
}

export interface AxisReferenceProps {
  data: LightmapCell_Input[][]
  style?: AxisStyle
  className?: string
}

export function extractCorners(data: LightmapCell_Input[][]): {
  bottomLeft: Point3D
  bottomRight: Point3D
  topLeft: Point3D
} | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const firstRow = data[0]
  if (!Array.isArray(firstRow) || firstRow.length === 0) return null

  const lastRow = data.length - 1
  const lastCol = firstRow.length - 1

  const toPoint = (cell: LightmapCell_Input | undefined): Point3D | null => {
    if (!cell || !Array.isArray(cell[0]) || cell[0].length < 3) return null
    const [x, y, z] = cell[0]
    return { x: x ?? 0, y: y ?? 0, z: z ?? 0 }
  }

  const bl = toPoint(data[lastRow]?.[0])
  const br = toPoint(data[lastRow]?.[lastCol])
  const tl = toPoint(data[0]?.[0])

  if (!bl || !br || !tl) return null

  return { bottomLeft: bl, bottomRight: br, topLeft: tl }
}

export function computeDirectionVectors(
  bottomLeft: Point3D,
  bottomRight: Point3D,
  topLeft: Point3D
): { vecX: Point3D; vecY: Point3D } {
  const sub = (a: Point3D, b: Point3D): Point3D => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  })

  const normalize = (v: Point3D): Point3D => {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    if (mag === 0) return { x: 0, y: 0, z: 0 }
    return {
      x: Math.round((v.x / mag) * 100) / 100,
      y: Math.round((v.y / mag) * 100) / 100,
      z: Math.round((v.z / mag) * 100) / 100,
    }
  }

  return {
    vecX: normalize(sub(bottomRight, bottomLeft)),
    vecY: normalize(sub(topLeft, bottomLeft)),
  }
}

export function formatVector(v: Point3D): string {
  const fmt = (n: number) => (isFinite(n) ? n.toFixed(2) : '—')
  return `(${fmt(v.x)}, ${fmt(v.y)}, ${fmt(v.z)})`
}

export function effectiveLength(length: number, arrowSize: number): number {
  return Math.max(length, arrowSize * 3)
}

type AxisDirection = 'horizontal' | 'vertical'

interface AxisArrowProps {
  direction: AxisDirection
  label: string
  color: string
  thickness: number
  arrowSize: number
  labelFontSize: number
  length: number
}

function AxisArrow({
  direction,
  label,
  color,
  thickness,
  arrowSize,
  labelFontSize,
  length,
}: AxisArrowProps): React.ReactElement {
  const len = effectiveLength(length, arrowSize)

  if (direction === 'horizontal') {
    const h = Math.max(arrowSize * 2, labelFontSize + 8)
    const cy = h / 2

    return (
      <svg
        className="axis-arrow-svg axis-arrow-svg--horizontal"
        width={len}
        height={h}
        overflow="visible"
        aria-hidden="true"
        style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))' }}
      >
        <defs>
          <linearGradient id="axis-gradient-h" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <line
          x1={0} y1={cy} x2={len - arrowSize} y2={cy}
          stroke="url(#axis-gradient-h)" strokeWidth={thickness} strokeLinecap="round"
        />
        <polygon
          points={`${len - arrowSize},${cy - arrowSize / 2} ${len},${cy} ${len - arrowSize},${cy + arrowSize / 2}`}
          fill={color}
          opacity={0.95}
        />
        <text
          x={len + 10}
          y={cy}
          fill={color}
          fontSize={labelFontSize}
          dominantBaseline="middle"
          fontFamily="'SF Mono', 'Fira Code', 'Consolas', monospace"
          fontWeight="500"
          opacity={0.9}
          letterSpacing="0.5"
          style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' }}
        >
          {label}
        </text>
      </svg>
    )
  } else {
    const w = Math.max(arrowSize * 2, thickness + 4)
    const cx = w / 2
    return (
      <svg
        className="axis-arrow-svg axis-arrow-svg--vertical"
        width={w}
        height={len}
        overflow="visible"
        aria-hidden="true"
        style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))' }}
      >
        <defs>
          <linearGradient id="axis-gradient-v" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <line
          x1={cx} y1={len} x2={cx} y2={arrowSize}
          stroke="url(#axis-gradient-v)" strokeWidth={thickness} strokeLinecap="round"
        />
        <polygon
          points={`${cx - arrowSize / 2},${arrowSize} ${cx},${0} ${cx + arrowSize / 2},${arrowSize}`}
          fill={color}
          opacity={0.95}
        />
        <text
          x={cx - arrowSize - 6}
          y={len / 2}
          fill={color}
          fontSize={labelFontSize}
          dominantBaseline="middle"
          textAnchor="end"
          fontFamily="'SF Mono', 'Fira Code', 'Consolas', monospace"
          fontWeight="500"
          opacity={0.9}
          letterSpacing="0.5"
          style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' }}
        >
          {label}
        </text>
      </svg>
    )
  }
}

export { AxisArrow }
export type { AxisArrowProps, AxisDirection }


const DEFAULT_STYLE: Required<AxisStyle> = {
  color: '#f5f5f5',
  thickness: 2,
  arrowSize: 6,
  labelFontSize: 10,
  length: 40,
  gap: 10,
}

export function AxisReference({
  data,
  style,
  className,
}: AxisReferenceProps): React.ReactElement | null {
  const corners = extractCorners(data)

  if (!corners) {
    console.warn('[AxisReference] Matriz de dados vazia ou inválida.')
    return null
  }

  const { bottomLeft, bottomRight, topLeft } = corners
  const { vecX, vecY } = computeDirectionVectors(bottomLeft, bottomRight, topLeft)

  const color         = style?.color         ?? DEFAULT_STYLE.color
  const thickness     = style?.thickness     ?? DEFAULT_STYLE.thickness
  const arrowSize     = style?.arrowSize     ?? DEFAULT_STYLE.arrowSize
  const labelFontSize = style?.labelFontSize ?? DEFAULT_STYLE.labelFontSize
  const length        = style?.length        ?? DEFAULT_STYLE.length
  const gap           = style?.gap           ?? DEFAULT_STYLE.gap

  const labelX = formatVector(vecX)
  const labelY = formatVector(vecY)

  return (
    <div
      className={['axis-reference', className].filter(Boolean).join(' ')}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div
        className="axis-arrow"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          transform: `translateY(calc(100% + ${gap}px))`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <AxisArrow
          direction="horizontal"
          label={labelX}
          color={color}
          thickness={thickness}
          arrowSize={arrowSize}
          labelFontSize={labelFontSize}
          length={length}
        />
      </div>

      <div
        className="axis-arrow"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          transform: `translateX(calc(-100% - ${gap}px))`,
        }}
      >
        <AxisArrow
          direction="vertical"
          label={labelY}
          color={color}
          thickness={thickness}
          arrowSize={arrowSize}
          labelFontSize={labelFontSize}
          length={length}
        />
      </div>
    </div>
  )
}
