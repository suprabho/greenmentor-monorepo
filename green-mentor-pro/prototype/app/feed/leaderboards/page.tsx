import { Fire, Lightning, Medal, TrendUp, TrendDown } from "@phosphor-icons/react/dist/ssr";
import { Avatar, Card, Chip, PageHeader } from "@/components/ui";
import { leaderboard, avatarFor } from "@/lib/data";

export default function LeaderboardsPage() {
  return (
    <div>
      <PageHeader
        title="Leaderboards"
        sub="XP earned across the Academy, Feed and challenges. Resets weekly; all-time board keeps the legends."
      />

      <div className="mb-4 flex gap-2">
        <button className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12.5px] font-semibold text-white">This week</button>
        <button className="rounded-pill border border-gray-200 bg-white px-4 py-1.5 text-[12.5px] font-medium text-gray-700">All-time</button>
        <button className="rounded-pill border border-gray-200 bg-white px-4 py-1.5 text-[12.5px] font-medium text-gray-700">By course</button>
      </div>

      {/* Podium */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {leaderboard.slice(0, 3).map((u, i) => (
          <Card key={u.rank} className={i === 0 ? "border-green-500 p-5 ring-1 ring-green-500" : "p-5"}>
            <div className="flex items-center gap-3">
              <Avatar
                src={avatarFor(u.name)}
                name={u.name}
                size={44}
                className={i === 0 ? "ring-2 ring-green-500" : "ring-2 ring-green-100"}
              />
              <div>
                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                  <Medal size={15} weight="fill" className={i === 0 ? "text-[#E8B400]" : i === 1 ? "text-gray-400" : "text-[#B26B2B]"} />
                  {u.name}
                </div>
                <div className="text-[12px] text-gray-600">{u.badge}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 text-[12.5px] font-semibold">
              <span className="flex items-center gap-1 text-green-700"><Lightning size={13} weight="fill" /> {u.xp.toLocaleString()} XP</span>
              <span className="flex items-center gap-1 text-[#B25E00]"><Fire size={13} weight="fill" /> {u.streak} days</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        {leaderboard.map((u) => (
          <div
            key={u.rank}
            className={
              "flex items-center gap-3 border-b border-gray-100 px-4 py-3.5 last:border-0 sm:gap-4 sm:px-5 " +
              (u.me ? "bg-green-50/60" : "")
            }
          >
            <span className="w-6 text-right text-[14px] font-bold text-gray-500">{u.rank}</span>
            <Avatar src={avatarFor(u.name)} name={u.name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                {u.name} {u.me && <Chip tone="green">You</Chip>}
              </div>
              <div className="text-[11.5px] text-gray-600">{u.badge}</div>
            </div>
            <span className="hidden sm:flex items-center gap-1 text-[12.5px] font-semibold text-[#B25E00]">
              <Fire size={13} weight="fill" /> {u.streak}d
            </span>
            <span className="w-14 text-right text-[13.5px] font-bold text-ink sm:w-24">{u.xp.toLocaleString()}</span>
            <span
              className={
                "flex w-12 items-center justify-end gap-0.5 text-[12px] font-semibold " +
                (u.delta.startsWith("+") ? "text-green-700" : u.delta === "0" ? "text-gray-400" : "text-danger")
              }
            >
              {u.delta.startsWith("+") ? <TrendUp size={13} /> : u.delta === "0" ? null : <TrendDown size={13} />}
              {u.delta}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
