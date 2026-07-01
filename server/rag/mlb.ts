export interface MlbGame {
  date: string;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  state: string;
}

export interface MlbScores {
  start: string;
  end: string;
  totalGames: number;
  games: MlbGame[];
}

interface MlbApiGame {
  teams: {
    away: { team: { name: string }; score?: number };
    home: { team: { name: string }; score?: number };
  };
  status: { detailedState: string };
}

interface MlbScheduleResponse {
  totalGames?: number;
  dates?: { date?: string; games?: MlbApiGame[] }[];
}

export async function fetchMlbScores(start: string, end: string = start): Promise<MlbScores> {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}`);
  if (!res.ok) {
    throw new Error(`MLB StatsAPI returned ${res.status}`);
  }
  const data = (await res.json()) as MlbScheduleResponse;
  const games: MlbGame[] = (data.dates ?? []).flatMap((d) =>
    (d.games ?? []).map((g) => ({
      date: d.date ?? start,
      away: g.teams.away.team.name,
      home: g.teams.home.team.name,
      awayScore: g.teams.away.score ?? null,
      homeScore: g.teams.home.score ?? null,
      state: g.status.detailedState,
    })),
  );
  return { start, end, totalGames: data.totalGames ?? games.length, games };
}
