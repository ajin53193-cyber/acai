export const StatusLogTable = function StatusLogTable({ rows, showAgent = false }) {
  if (!rows.length) return <div className="py-8 text-center text-xs text-slate-400">暂无上下线记录</div>;
  const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}小时${m % 60 ? `${m % 60}分` : ""}` : `${m}分钟`);
  return (
    <table className="w-full text-sm" data-testid="cs-status-log-table">
      <thead><tr className="text-left text-[11px] tracking-widest text-slate-400"><th className="pb-2 pr-3">日期</th>{showAgent && <th className="pb-2 pr-3">坐席</th>}<th className="pb-2 pr-3">首次上线</th><th className="pb-2 pr-3">最后下线</th><th className="pb-2 pr-3">在线时长</th><th className="pb-2">时段明细</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.date}|${r.agent_id}`} className="border-t border-current/10 align-top" data-testid={`cs-status-row-${r.date}-${r.agent_id}`}>
            <td className="py-2 pr-3 whitespace-nowrap font-medium">{r.date}</td>
            {showAgent && <td className="py-2 pr-3 whitespace-nowrap">{r.agent_name}</td>}
            <td className="py-2 pr-3 whitespace-nowrap text-green-600">{r.first_online || "—"}</td>
            <td className="py-2 pr-3 whitespace-nowrap">{r.online_now ? <span className="text-green-600">在线中</span> : (r.last_offline || "—")}</td>
            <td className="py-2 pr-3 whitespace-nowrap font-bold">{fmt(r.online_minutes)}</td>
            <td className="py-2 text-xs opacity-80">{r.segments.map((sg, i) => <span key={i} className="mr-2 inline-block whitespace-nowrap">{sg.from}–{sg.to || "至今"}{sg.auto && <span className="ml-0.5 text-amber-600" title="超时未操作，系统自动记为下线">(自动)</span>}</span>)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
