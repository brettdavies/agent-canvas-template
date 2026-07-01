import { analyzeGames } from '@shared/mlb';
import { describe, expect, it } from 'vitest';

describe('analyzeGames', () => {
  const games = [
    { away: { name: 'A', score: 5 }, home: { name: 'B', score: 3 } },
    { gamePk: 2, away: { name: 'A', score: 0 }, home: { name: 'C', score: 7 } },
    { away: { name: 'B', score: 2 }, home: { name: 'C', score: 2 } },
  ];

  it('aggregates run totals and averages', () => {
    const r = analyzeGames(games);
    expect(r.gameCount).toBe(3);
    expect(r.scoredGameCount).toBe(3);
    expect(r.totalRuns).toBe(19);
    expect(r.averageRunsPerGame).toBeCloseTo(19 / 3, 2);
  });

  it('finds the highest-scoring game and counts shutouts', () => {
    const r = analyzeGames(games);
    expect(r.highestScoring?.totalRuns).toBe(8);
    expect(r.shutouts).toBe(1);
  });

  it('builds per-team win/loss records, skipping ties', () => {
    const r = analyzeGames(games);
    const c = r.teamRecords.find((t) => t.team === 'C');
    expect(c).toEqual({ team: 'C', wins: 1, losses: 0, runsFor: 9, runsAgainst: 2 });
    const b = r.teamRecords.find((t) => t.team === 'B');
    expect(b).toEqual({ team: 'B', wins: 0, losses: 1, runsFor: 5, runsAgainst: 7 });
  });

  it('excludes games missing a score from scored aggregates', () => {
    const r = analyzeGames([...games, { away: { name: 'A' }, home: { name: 'B', score: 4 } }]);
    expect(r.gameCount).toBe(4);
    expect(r.scoredGameCount).toBe(3);
  });
});
