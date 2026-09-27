const WHEEL_OFFSETS = [0, 50];

/** public/scenery/car.svg with round wheels, idling: the body bobs a pixel and the hubs spin in two frames. */
export function IdleCar({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 44"
      width={384}
      height={176}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      <path fill="#27364d" fillOpacity=".22" d="M8 39h82v3H8z" />
      <g className="car-idle">
        <g stroke="#27364d" strokeWidth="2" strokeLinejoin="round">
          <path fill="#d9534a" d="M24 20 32 8h30l12 12h12l6 4v10H6V24l6-4z" />
          <path fill="#b8413b" d="M6 30h86v4H6z" />
          <path fill="#9fd3f5" d="M29 19 34 11h12v8zM50 19v-8h10l8 8z" />
          <path fill="#ffe07a" d="M86 23h5v4h-5z" />
          <path fill="#ff8a65" d="M6 23h4v4H6z" />
        </g>
        <path fill="#fff" fillOpacity=".45" d="M35 12h3v2h-3zM51 12h3v2h-3z" />
        <path fill="#27364d" d="M47 21h2v8h-2zM44 23h3v1h-3z" />
      </g>
      {WHEEL_OFFSETS.map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          <path
            fill="#2a2a3c"
            stroke="#27364d"
            strokeWidth="2"
            strokeLinejoin="round"
            d="M21 30h4v1h2v1h1v2h1v4h-1v2h-1v1h-2v1h-4v-1h-2v-1h-1v-2h-1v-4h1v-2h1v-1h2z"
          />
          <path fill="#c8d0dc" d="M21 33h4v1h1v4h-1v1h-4v-1h-1v-4h1z" />
          <path className="wheel-a" fill="#27364d" d="M22 33h2v6h-2zM20 35h6v2h-6z" />
          <path
            className="wheel-b"
            fill="#27364d"
            d="M21 34h1v1h-1zM22 35h1v1h-1zM23 36h1v1h-1zM24 37h1v1h-1zM24 34h1v1h-1zM23 35h1v1h-1zM22 36h1v1h-1zM21 37h1v1h-1z"
          />
        </g>
      ))}
    </svg>
  );
}
