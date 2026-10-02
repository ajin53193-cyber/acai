const ITEMS = ["连接资金", "渠道拓展", "团长合伙", "优质项目对接", "社群共建", "商业合作", "资源匹配", "聚力共赢"];

export const Marquee = () => {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      data-testid="editorial-marquee"
      className="relative overflow-hidden border-y border-amber-500/15 bg-[#0A1228]/60 py-4"
    >
      <div className="animate-marquee flex w-max items-center">
        {row.map((item, i) => (
          <span key={i} className="flex items-center">
            <span className="font-display px-8 text-sm font-semibold tracking-[0.3em] text-[#E5C158]/80 sm:text-base">
              {item}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-70">
              <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="#D4AF37" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
};
