"""统一业务时区：北京时间 (UTC+8)。数据库 created_at 仍为 UTC ISO 字符串，这里负责按北京日切做统计/查询。"""
from datetime import datetime, timedelta, timezone

BJ = timezone(timedelta(hours=8))


def now() -> datetime:
    return datetime.now(BJ)


def today() -> str:
    return now().strftime("%Y-%m-%d")


def days_ago(n: int) -> str:
    return (now() - timedelta(days=n)).strftime("%Y-%m-%d")


def day(ts) -> str:
    """UTC ISO 字符串 -> 北京日期 YYYY-MM-DD"""
    if not ts:
        return ""
    try:
        d = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(BJ).strftime("%Y-%m-%d")
    except Exception:
        return str(ts)[:10]


def start_utc(d: str) -> str:
    """北京日期 YYYY-MM-DD 的 00:00 -> UTC ISO 字符串（用于 created_at $gte/$lt 比较）"""
    if not d or len(d) < 10:
        return d
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").replace(tzinfo=BJ).astimezone(timezone.utc).isoformat()
    except Exception:
        return d


def rng(since: str, until: str = None) -> dict:
    q = {"$gte": start_utc(since)}
    if until:
        q["$lt"] = start_utc(until) if len(until) >= 10 else until
    return q


def today_q() -> dict:
    return rng(today(), days_ago(-1))


MONGO_DAY = {"$dateToString": {"format": "%Y-%m-%d", "timezone": "+08:00",
                               "date": {"$dateFromString": {"dateString": "$created_at", "onError": None, "onNull": None}}}}
