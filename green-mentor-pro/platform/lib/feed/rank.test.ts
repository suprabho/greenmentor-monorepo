import { describe, it, expect } from "vitest";
import { INDIA_BOOST_HOURS, rankFeed } from "./rank";

const T0 = Date.parse("2026-08-05T12:00:00.000Z");
const hours = (n: number) => new Date(T0 + n * 3_600_000).toISOString();

const india = (id: string, h: number) => ({ id, region: "india", published_at: hours(h) });
const global = (id: string, h: number) => ({ id, region: "global", published_at: hours(h) });

const order = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("rankFeed", () => {
  it("puts an Indian article ahead of a global one published later, within the boost", () => {
    expect(order(rankFeed([global("g", 24), india("i", 0)]))).toEqual(["i", "g"]);
  });

  it("lets a global article win once it is newer than the boost allows", () => {
    expect(order(rankFeed([india("i", 0), global("g", INDIA_BOOST_HOURS + 12)]))).toEqual(["g", "i"]);
  });

  it("still orders Indian articles among themselves by recency", () => {
    expect(order(rankFeed([india("old", 0), india("new", 5)]))).toEqual(["new", "old"]);
  });

  it("degrades to plain recency when nothing is tagged india", () => {
    expect(order(rankFeed([global("a", 1), global("c", 3), global("b", 2)]))).toEqual(["c", "b", "a"]);
  });

  it("sinks undated articles below everything, without an unstable comparator", () => {
    const undated = [
      { id: "n1", region: "india", published_at: null },
      { id: "n2", region: "global", published_at: null },
    ];
    expect(order(rankFeed([...undated, global("g", 0)]))).toEqual(["g", "n1", "n2"]);
  });

  it("treats a missing region as global", () => {
    expect(order(rankFeed([{ id: "u", published_at: hours(0) }, india("i", -12)]))).toEqual(["i", "u"]);
  });

  it("does not mutate its input", () => {
    const rows = [global("g", 0), india("i", -1)];
    rankFeed(rows);
    expect(order(rows)).toEqual(["g", "i"]);
  });
});
