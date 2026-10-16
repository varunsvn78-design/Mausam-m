import { WEATHER_GROUPS } from '../services/weatherCodes.js'

/**
 * Accessible SVG icon for a condition group.
 *
 * @param {{ group?: string, isDay?: boolean, size?: number, title?: string, className?: string }} props
 */
export function WeatherIcon({ group = WEATHER_GROUPS.UNKNOWN, isDay = true, size = 48, title, className }) {
  const label = title ?? 'Weather condition'
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    role: 'img',
    'aria-label': label,
    className: ['weather-icon', className].filter(Boolean).join(' '),
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  return (
    <svg {...common}>
      {renderIcon(group, isDay)}
    </svg>
  )
}

function Cloud({ transform, faint }) {
  return (
    <path
      d="M20 42h26a9 9 0 0 0 .6-18A13 13 0 0 0 22 22.5 10 10 0 0 0 20 42Z"
      transform={transform}
      opacity={faint ? 0.55 : 1}
    />
  )
}

function Sun({ cx = 24, cy = 22, r = 8, rays = true }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      {rays && (
        <>
          <line x1={cx} y1={cy - r - 6} x2={cx} y2={cy - r - 1} />
          <line x1={cx} y1={cy + r + 1} x2={cx} y2={cy + r + 6} />
          <line x1={cx - r - 6} y1={cy} x2={cx - r - 1} y2={cy} />
          <line x1={cx + r + 1} y1={cy} x2={cx + r + 6} y2={cy} />
          <line x1={cx - r - 4} y1={cy - r - 4} x2={cx - r - 1} y2={cy - r - 1} />
          <line x1={cx + r + 1} y1={cy + r + 1} x2={cx + r + 4} y2={cy + r + 4} />
          <line x1={cx + r + 1} y1={cy - r - 1} x2={cx + r + 4} y2={cy - r - 4} />
          <line x1={cx - r - 4} y1={cy + r + 4} x2={cx - r - 1} y2={cy + r + 1} />
        </>
      )}
    </>
  )
}

function Moon() {
  return <path d="M34 12a12 12 0 1 0 10 18 14 14 0 0 1-10-18Z" />
}

function Drops({ count = 3, y = 48 }) {
  const positions = count === 1 ? [32] : count === 2 ? [26, 40] : [24, 34, 44]
  return (
    <>
      {positions.map((x, index) => (
        <line key={x} x1={x} y1={y + 2} x2={x - 2} y2={y + 8 + (index % 2) * 3} />
      ))}
    </>
  )
}

function Flakes() {
  const points = [
    [24, 50],
    [34, 54],
    [44, 50],
  ]
  return (
    <>
      {points.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <line x1={x - 3} y1={y} x2={x + 3} y2={y} />
          <line x1={x} y1={y - 3} x2={x} y2={y + 3} />
          <line x1={x - 2} y1={y - 2} x2={x + 2} y2={y + 2} />
          <line x1={x + 2} y1={y - 2} x2={x - 2} y2={y + 2} />
        </g>
      ))}
    </>
  )
}

function renderIcon(group, isDay) {
  switch (group) {
    case WEATHER_GROUPS.CLEAR:
      return isDay ? <Sun cx={32} cy={32} r={12} /> : <Moon />
    case WEATHER_GROUPS.PARTLY_CLOUDY:
      return (
        <>
          {isDay ? <Sun cx={25} cy={22} r={8} /> : <Moon />}
          <Cloud transform="translate(4 8) scale(0.92)" />
        </>
      )
    case WEATHER_GROUPS.CLOUDY:
      return (
        <>
          <Cloud transform="translate(-4 -4) scale(0.72)" faint />
          <Cloud />
        </>
      )
    case WEATHER_GROUPS.FOG:
      return (
        <>
          <Cloud transform="translate(0 -6)" />
          <line x1={18} y1={50} x2={46} y2={50} />
          <line x1={22} y1={56} x2={42} y2={56} />
        </>
      )
    case WEATHER_GROUPS.DRIZZLE:
      return (
        <>
          <Cloud transform="translate(0 -4)" />
          <line x1={26} y1={48} x2={25} y2={53} />
          <line x1={36} y1={48} x2={35} y2={53} />
        </>
      )
    case WEATHER_GROUPS.RAIN:
    case WEATHER_GROUPS.SHOWERS:
      return (
        <>
          <Cloud transform="translate(0 -4)" />
          <Drops count={3} y={46} />
        </>
      )
    case WEATHER_GROUPS.SNOW:
      return (
        <>
          <Cloud transform="translate(0 -4)" />
          <Flakes />
        </>
      )
    case WEATHER_GROUPS.THUNDERSTORM:
      return (
        <>
          <Cloud transform="translate(0 -6)" />
          <path d="M32 40l-7 12h6l-2 8 9-13h-6l3-7Z" />
        </>
      )
    default:
      return (
        <>
          <Cloud />
          <path d="M32 26v8" />
          <circle cx={32} cy={39} r={0.5} />
        </>
      )
  }
}

export default WeatherIcon
