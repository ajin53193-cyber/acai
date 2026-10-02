export const LogoMark = ({ size = 42 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" data-testid="logo-mark">
    <defs>
      <linearGradient id="logoGold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#FFE896" />
        <stop offset="0.5" stopColor="#D4AF37" />
        <stop offset="1" stopColor="#997316" />
      </linearGradient>
    </defs>
    <path d="M24 2 43 13v22L24 46 5 35V13L24 2z" fill="url(#logoGold)" />
    <path d="M24 7.5 38 15.7v16.6L24 40.5 10 32.3V15.7L24 7.5z" fill="#0A1228" />
    <text
      x="24"
      y="32"
      textAnchor="middle"
      fontSize="19"
      fontWeight="900"
      fill="url(#logoGold)"
      fontFamily="'Noto Serif SC', serif"
    >
      合
    </text>
  </svg>
);

export const LogoFull = () => (
  <div className="flex items-center gap-3" data-testid="logo-full">
    <LogoMark />
    <div className="leading-tight">
      <div className="font-display text-xl font-black tracking-wide text-gold-gradient">合赢项目社</div>
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
        Heying Project Club
      </div>
    </div>
  </div>
);
