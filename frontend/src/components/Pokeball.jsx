export default function Pokeball({ className = "h-6 w-6", spin = false }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} ${spin ? "animate-spin-slow" : ""}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pb-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>
        <linearGradient id="pb-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#pb-white)" stroke="#0B0F1A" strokeWidth="3" />
      <path
        d="M2 32 A30 30 0 0 1 62 32 Z"
        fill="url(#pb-red)"
        stroke="#0B0F1A"
        strokeWidth="3"
      />
      <rect x="2" y="29" width="60" height="6" fill="#0B0F1A" />
      <circle cx="32" cy="32" r="8" fill="#0B0F1A" />
      <circle cx="32" cy="32" r="5" fill="#F8FAFC" stroke="#0B0F1A" strokeWidth="1.5" />
      <circle cx="30" cy="30" r="1.5" fill="#CBD5E1" />
    </svg>
  );
}
