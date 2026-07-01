import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db, sql } from '../../server/db/client';
import {
  homeruns,
  statsEmbeddings,
  statsGameBatting,
  statsGameFielding,
  statsGamePitching,
  statsGames,
  statsHomeruns,
  statsLinescore,
  statsOfficials,
  statsPeople,
  statsPitches,
  statsPlays,
  statsRunners,
  statsTeams,
  statsVenues,
} from '../../server/db/schema';

// biome-ignore lint/suspicious/noExplicitAny: StatsAPI feed is untyped JSON.
type Json = any;

const FEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'feeds');
const CHUNK = 1000;

function feedFiles(): string[] {
  return readdirSync(FEEDS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => Number(a.replace('.json', '')) - Number(b.replace('.json', '')));
}

function readFeed(file: string): Json {
  return JSON.parse(readFileSync(join(FEEDS_DIR, file), 'utf8'));
}

// Insert in parameter-safe chunks. `onConflictDoNothing` keeps re-runs idempotent
// on tables that carry a natural unique key.
async function insertChunked(table: PgTable, rows: Json[], chunk = CHUNK) {
  for (let i = 0; i < rows.length; i += chunk) {
    // biome-ignore lint/suspicious/noExplicitAny: heterogeneous row shapes per table.
    await db
      .insert(table)
      .values(rows.slice(i, i + chunk) as any)
      .onConflictDoNothing();
  }
}

// Remove every per-game row scoped to this game so a re-run cannot duplicate the
// tables that lack a natural unique key (runners, officials) or that get fresh
// UUIDs on each load (plays, and their staged embeddings). Homeruns and their
// embeddings are owned by the global homeruns phase, not here.
async function cleanupGame(gameId: string) {
  const playRows = await db.select({ id: statsPlays.id }).from(statsPlays).where(eq(statsPlays.gameId, gameId));
  const playIds = playRows.map((r) => r.id);
  if (playIds.length) {
    await db
      .delete(statsEmbeddings)
      .where(and(inArray(statsEmbeddings.sourceId, playIds), eq(statsEmbeddings.sourceTable, 'stats_plays')));
  }
  await db.delete(statsRunners).where(eq(statsRunners.gameId, gameId));
  await db.delete(statsPitches).where(eq(statsPitches.gameId, gameId));
  await db.delete(statsGameBatting).where(eq(statsGameBatting.gameId, gameId));
  await db.delete(statsGamePitching).where(eq(statsGamePitching.gameId, gameId));
  await db.delete(statsGameFielding).where(eq(statsGameFielding.gameId, gameId));
  await db.delete(statsLinescore).where(eq(statsLinescore.gameId, gameId));
  await db.delete(statsOfficials).where(eq(statsOfficials.gameId, gameId));
  await db.delete(statsPlays).where(eq(statsPlays.gameId, gameId));
  await db.delete(statsGames).where(eq(statsGames.id, gameId));
}

// ---------------------------------------------------------------------------
// Phase A — reference tables (teams / venues / people), upserted once.
// ---------------------------------------------------------------------------
async function loadReference() {
  const teamRows = new Map<number, Json>();
  const venueRows = new Map<number, Json>();
  const peopleRows = new Map<number, Json>();

  const files = feedFiles();
  let scanned = 0;
  for (const file of files) {
    let feed: Json;
    try {
      feed = readFeed(file);
    } catch (err) {
      console.error(`[ref] skip ${file}: ${(err as Error).message}`);
      continue;
    }
    const gameData: Json = feed.gameData ?? {};

    for (const t of [gameData.teams?.away, gameData.teams?.home] as Json[]) {
      if (!t?.id || teamRows.has(t.id)) continue;
      teamRows.set(t.id, {
        mlbId: t.id,
        name: t.name,
        abbreviation: t.abbreviation,
        teamName: t.teamName,
        locationName: t.locationName,
        leagueId: t.league?.id,
        leagueName: t.league?.name,
        divisionId: t.division?.id,
        divisionName: t.division?.name,
        venueMlbId: t.venue?.id,
        firstYearOfPlay: t.firstYearOfPlay,
        active: t.active,
        raw: t,
      });
    }

    const v: Json = gameData.venue;
    if (v?.id && !venueRows.has(v.id)) {
      venueRows.set(v.id, {
        mlbId: v.id,
        name: v.name,
        city: v.location?.city,
        state: v.location?.state,
        stateAbbrev: v.location?.stateAbbrev,
        country: v.location?.country,
        latitude: v.location?.defaultCoordinates?.latitude,
        longitude: v.location?.defaultCoordinates?.longitude,
        elevation: v.location?.elevation,
        capacity: v.fieldInfo?.capacity,
        turfType: v.fieldInfo?.turfType,
        roofType: v.fieldInfo?.roofType,
        leftLine: v.fieldInfo?.leftLine,
        center: v.fieldInfo?.center,
        rightLine: v.fieldInfo?.rightLine,
        timezoneId: v.timeZone?.id,
        timezoneOffset: v.timeZone?.offset,
        raw: v,
      });
    }

    for (const p of Object.values<Json>(gameData.players ?? {})) {
      if (!p?.id || peopleRows.has(p.id)) continue;
      peopleRows.set(p.id, {
        mlbId: p.id,
        fullName: p.fullName,
        firstName: p.firstName,
        lastName: p.lastName,
        primaryNumber: p.primaryNumber,
        birthDate: p.birthDate,
        currentAge: p.currentAge,
        birthCity: p.birthCity,
        birthCountry: p.birthCountry,
        height: p.height,
        weight: p.weight,
        active: p.active,
        positionCode: p.primaryPosition?.code,
        positionName: p.primaryPosition?.name,
        positionType: p.primaryPosition?.type,
        positionAbbrev: p.primaryPosition?.abbreviation,
        batSideCode: p.batSide?.code,
        batSideDesc: p.batSide?.description,
        pitchHandCode: p.pitchHand?.code,
        pitchHandDesc: p.pitchHand?.description,
        mlbDebutDate: p.mlbDebutDate,
        raw: p,
      });
    }

    scanned += 1;
    if (scanned % 500 === 0) {
      console.log(`[ref] scanned ${scanned}/${files.length} feeds`);
    }
  }

  await insertChunked(statsTeams, [...teamRows.values()]);
  await insertChunked(statsVenues, [...venueRows.values()]);
  await insertChunked(statsPeople, [...peopleRows.values()]);

  // Build the maps AFTER the upsert so they include rows that pre-existed from
  // the one-game slice, not just freshly inserted ones.
  const teams = await db.select({ id: statsTeams.id, mlbId: statsTeams.mlbId }).from(statsTeams);
  const venues = await db.select({ id: statsVenues.id, mlbId: statsVenues.mlbId }).from(statsVenues);
  const people = await db.select({ id: statsPeople.id, mlbId: statsPeople.mlbId }).from(statsPeople);

  console.log(
    `[ref] teams=${teams.length} venues=${venues.length} people=${people.length} (collected ` +
      `${teamRows.size}/${venueRows.size}/${peopleRows.size})`,
  );

  return {
    teamMap: new Map<number, string>(teams.map((r) => [r.mlbId, r.id])),
    venueMap: new Map<number, string>(venues.map((r) => [r.mlbId, r.id])),
    peopleMap: new Map<number, string>(people.map((r) => [r.mlbId, r.id])),
  };
}

// ---------------------------------------------------------------------------
// Phase B — one game's full flatten, FKs resolved via the Phase-A maps.
// ---------------------------------------------------------------------------
async function loadGame(
  feed: Json,
  maps: { teamMap: Map<number, string>; venueMap: Map<number, string>; peopleMap: Map<number, string> },
) {
  const { teamMap, venueMap, peopleMap } = maps;
  const person = (id: number | undefined | null) => (id == null ? undefined : peopleMap.get(id));

  const gameData: Json = feed.gameData ?? {};
  const liveData: Json = feed.liveData ?? {};
  const gamePk: number = feed.gamePk;

  const prior = await db.select({ id: statsGames.id }).from(statsGames).where(eq(statsGames.gamePk, gamePk));
  if (prior[0]) await cleanupGame(prior[0].id);

  const decisions: Json = liveData.decisions ?? {};
  const ls: Json = liveData.linescore ?? {};
  const v: Json = gameData.venue ?? {};

  const [gameRow] = await db
    .insert(statsGames)
    .values({
      gamePk,
      gameGuid: gameData.game?.id,
      season: gameData.game?.season != null ? Number(gameData.game.season) : undefined,
      gameType: gameData.game?.type,
      gameDate: gameData.datetime?.dateTime,
      officialDate: gameData.datetime?.officialDate,
      awayTeamId: teamMap.get(gameData.teams?.away?.id),
      homeTeamId: teamMap.get(gameData.teams?.home?.id),
      awayScore: ls.teams?.away?.runs,
      homeScore: ls.teams?.home?.runs,
      venueId: venueMap.get(v.id),
      statusAbstract: gameData.status?.abstractGameState,
      statusDetailed: gameData.status?.detailedState,
      statusCoded: gameData.status?.codedGameState,
      dayNight: gameData.datetime?.dayNight,
      doubleHeader: gameData.game?.doubleHeader,
      gameNumber: gameData.game?.gameNumber,
      seriesDescription: gameData.game?.seriesDescription,
      seriesGameNumber: gameData.game?.seriesGameNumber,
      gamesInSeries: gameData.game?.gamesInSeries,
      scheduledInnings: ls.scheduledInnings,
      weatherCondition: gameData.weather?.condition,
      weatherTemp: gameData.weather?.temp,
      weatherWind: gameData.weather?.wind,
      winPitcherId: person(decisions.winner?.id),
      lossPitcherId: person(decisions.loser?.id),
      savePitcherId: person(decisions.save?.id),
      attendance: gameData.gameInfo?.attendance,
      raw: {
        game: gameData.game,
        datetime: gameData.datetime,
        status: gameData.status,
        weather: gameData.weather,
        gameInfo: gameData.gameInfo,
        decisions,
      },
    })
    .returning({ id: statsGames.id });
  const gameId = gameRow.id;

  // --- plays (returning builds the atBatIndex -> uuid map; the game was just
  // cleaned, so every play is a fresh insert and returning yields them all) ---
  const allPlays: Json[] = liveData.plays?.allPlays ?? [];
  const playMap = new Map<number, string>();
  if (allPlays.length) {
    const inserted = await db
      .insert(statsPlays)
      .values(
        allPlays.map((p) => ({
          gameId,
          atBatIndex: p.about?.atBatIndex,
          resultType: p.result?.type,
          event: p.result?.event,
          eventType: p.result?.eventType,
          description: p.result?.description,
          rbi: p.result?.rbi,
          isOut: p.result?.isOut,
          isScoringPlay: p.about?.isScoringPlay,
          halfInning: p.about?.halfInning,
          inning: p.about?.inning,
          balls: p.count?.balls,
          strikes: p.count?.strikes,
          outs: p.count?.outs,
          batterId: person(p.matchup?.batter?.id),
          pitcherId: person(p.matchup?.pitcher?.id),
          batSide: p.matchup?.batSide?.code,
          pitchHand: p.matchup?.pitchHand?.code,
          raw: p,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: statsPlays.id, atBatIndex: statsPlays.atBatIndex });
    for (const r of inserted) {
      if (r.atBatIndex != null) playMap.set(r.atBatIndex, r.id);
    }
  }

  // --- pitches ---
  const pitchValues: Json[] = [];
  for (const p of allPlays) {
    const playUuid = playMap.get(p.about?.atBatIndex);
    for (const ev of p.playEvents ?? []) {
      if (ev.type !== 'pitch') continue;
      const pd: Json = ev.pitchData ?? {};
      const co: Json = pd.coordinates ?? {};
      const br: Json = pd.breaks ?? {};
      const hd: Json = ev.hitData ?? {};
      const hc: Json = hd.coordinates ?? {};
      pitchValues.push({
        gameId,
        playIdFk: playUuid,
        atBatIndex: p.about?.atBatIndex,
        pitchNumber: ev.pitchNumber,
        playId: ev.playId,
        callCode: ev.details?.call?.code,
        callDescription: ev.details?.call?.description,
        description: ev.details?.description,
        pitchTypeCode: ev.details?.type?.code,
        pitchTypeDesc: ev.details?.type?.description,
        isInPlay: ev.details?.isInPlay,
        isStrike: ev.details?.isStrike,
        isBall: ev.details?.isBall,
        startSpeed: pd.startSpeed,
        endSpeed: pd.endSpeed,
        strikeZoneTop: pd.strikeZoneTop,
        strikeZoneBottom: pd.strikeZoneBottom,
        zone: pd.zone,
        typeConfidence: pd.typeConfidence,
        plateTime: pd.plateTime,
        extension: pd.extension,
        px: co.pX,
        pz: co.pZ,
        pfxX: co.pfxX,
        pfxZ: co.pfxZ,
        breakAngle: br.breakAngle,
        breakLength: br.breakLength,
        breakVertical: br.breakVertical,
        breakVerticalInduced: br.breakVerticalInduced,
        breakHorizontal: br.breakHorizontal,
        spinRate: br.spinRate,
        spinDirection: br.spinDirection,
        exitVelocity: hd.launchSpeed,
        launchAngle: hd.launchAngle,
        totalDistance: hd.totalDistance,
        trajectory: hd.trajectory,
        hardness: hd.hardness,
        hitLocation: hd.location,
        hitCoordX: hc.coordX,
        hitCoordY: hc.coordY,
        raw: ev,
      });
    }
  }
  await insertChunked(statsPitches, pitchValues);

  // --- runners ---
  const runnerValues: Json[] = [];
  for (const p of allPlays) {
    const playUuid = playMap.get(p.about?.atBatIndex);
    for (const r of p.runners ?? []) {
      runnerValues.push({
        gameId,
        playIdFk: playUuid,
        runnerId: person(r.details?.runner?.id),
        originBase: r.movement?.originBase,
        startBase: r.movement?.start,
        endBase: r.movement?.end,
        outBase: r.movement?.outBase,
        isOut: r.movement?.isOut,
        isScoringEvent: r.details?.isScoringEvent,
        rbi: r.details?.rbi,
        earned: r.details?.earned,
        event: r.details?.event,
        eventType: r.details?.eventType,
        responsiblePitcherId: person(r.details?.responsiblePitcher?.id),
        raw: r,
      });
    }
  }
  await insertChunked(statsRunners, runnerValues);

  // --- boxscore: batting / pitching / fielding ---
  const battingValues: Json[] = [];
  const pitchingValues: Json[] = [];
  const fieldingValues: Json[] = [];
  for (const side of ['away', 'home'] as const) {
    const team: Json = liveData.boxscore?.teams?.[side];
    if (!team) continue;
    const teamUuid = teamMap.get(team.team?.id);
    for (const pl of Object.values<Json>(team.players ?? {})) {
      const personUuid = person(pl.person?.id);
      const b: Json = pl.stats?.batting ?? {};
      const pi: Json = pl.stats?.pitching ?? {};
      const f: Json = pl.stats?.fielding ?? {};
      if (Object.keys(b).length > 0) {
        battingValues.push({
          gameId,
          teamId: teamUuid,
          personId: personUuid,
          battingOrder: pl.battingOrder,
          position: pl.position?.abbreviation,
          atBats: b.atBats,
          runs: b.runs,
          hits: b.hits,
          doubles: b.doubles,
          triples: b.triples,
          homeRuns: b.homeRuns,
          rbi: b.rbi,
          baseOnBalls: b.baseOnBalls,
          strikeOuts: b.strikeOuts,
          stolenBases: b.stolenBases,
          leftOnBase: b.leftOnBase,
          totalBases: b.totalBases,
          plateAppearances: b.plateAppearances,
          hitByPitch: b.hitByPitch,
          sacFlies: b.sacFlies,
          sacBunts: b.sacBunts,
          groundIntoDoublePlay: b.groundIntoDoublePlay,
          raw: b,
        });
      }
      if (Object.keys(pi).length > 0) {
        pitchingValues.push({
          gameId,
          teamId: teamUuid,
          personId: personUuid,
          inningsPitched: pi.inningsPitched,
          hits: pi.hits,
          runs: pi.runs,
          earnedRuns: pi.earnedRuns,
          homeRuns: pi.homeRuns,
          baseOnBalls: pi.baseOnBalls,
          strikeOuts: pi.strikeOuts,
          battersFaced: pi.battersFaced,
          pitchesThrown: pi.pitchesThrown,
          balls: pi.balls,
          strikes: pi.strikes,
          wins: pi.wins,
          losses: pi.losses,
          saves: pi.saves,
          holds: pi.holds,
          blownSaves: pi.blownSaves,
          hitBatsmen: pi.hitBatsmen,
          wildPitches: pi.wildPitches,
          balks: pi.balks,
          raw: pi,
        });
      }
      if (Object.keys(f).length > 0) {
        fieldingValues.push({
          gameId,
          teamId: teamUuid,
          personId: personUuid,
          putOuts: f.putOuts,
          assists: f.assists,
          errors: f.errors,
          chances: f.chances,
          passedBall: f.passedBall,
          pickoffs: f.pickoffs,
          raw: f,
        });
      }
    }
  }
  await insertChunked(statsGameBatting, battingValues);
  await insertChunked(statsGamePitching, pitchingValues);
  await insertChunked(statsGameFielding, fieldingValues);

  // --- linescore ---
  const innings: Json[] = ls.innings ?? [];
  if (innings.length) {
    await insertChunked(
      statsLinescore,
      innings.map((inn) => ({
        gameId,
        inning: inn.num,
        ordinal: inn.ordinalNum,
        homeRuns: inn.home?.runs,
        homeHits: inn.home?.hits,
        homeErrors: inn.home?.errors,
        homeLob: inn.home?.leftOnBase,
        awayRuns: inn.away?.runs,
        awayHits: inn.away?.hits,
        awayErrors: inn.away?.errors,
        awayLob: inn.away?.leftOnBase,
        raw: inn,
      })),
    );
  }

  // --- officials (umpires usually absent from gameData.players; keep full_name) ---
  const officials: Json[] = liveData.boxscore?.officials ?? [];
  if (officials.length) {
    await db.insert(statsOfficials).values(
      officials.map((o) => ({
        gameId,
        officialType: o.officialType,
        personId: person(o.official?.id),
        fullName: o.official?.fullName,
        raw: o,
      })),
    );
  }

  // --- staged play-description embeddings (vectors stay NULL — no OpenAI) ---
  const embeddingValues: Json[] = [];
  for (const p of allPlays) {
    const desc: string | undefined = p.result?.description;
    const playUuid = playMap.get(p.about?.atBatIndex);
    if (playUuid && desc && desc.trim() !== '') {
      embeddingValues.push({
        sourceTable: 'stats_plays',
        sourceId: playUuid,
        columnName: 'description',
        content: desc,
        model: null,
        embedding: null,
      });
    }
  }
  await insertChunked(statsEmbeddings, embeddingValues);

  return {
    plays: playMap.size,
    pitches: pitchValues.length,
    runners: runnerValues.length,
    batting: battingValues.length,
    pitching: pitchingValues.length,
    fielding: fieldingValues.length,
    linescore: innings.length,
    officials: officials.length,
    embeddings: embeddingValues.length,
  };
}

// ---------------------------------------------------------------------------
// Phase C — homeruns bridge from the legacy `homeruns` table, plus their staged
// title embeddings. stats_homeruns has no natural unique key, so this phase is
// made idempotent by wiping its rows (and their embeddings) before reloading.
// ---------------------------------------------------------------------------
async function loadHomeruns() {
  await db.delete(statsEmbeddings).where(eq(statsEmbeddings.sourceTable, 'stats_homeruns'));
  await db.delete(statsHomeruns);

  const all = await db.select().from(homeruns);
  await insertChunked(
    statsHomeruns,
    all.map((h) => ({
      season: h.season,
      playId: h.playId,
      title: h.title,
      exitVelocity: h.exitVelocity,
      hitDistance: h.hitDistance,
      launchAngle: h.launchAngle,
      video: h.video,
      raw: h,
    })),
  );

  const hrRows = await db.select({ id: statsHomeruns.id, title: statsHomeruns.title }).from(statsHomeruns);
  const embeddingValues: Json[] = [];
  for (const row of hrRows) {
    if (row.title && row.title.trim() !== '') {
      embeddingValues.push({
        sourceTable: 'stats_homeruns',
        sourceId: row.id,
        columnName: 'title',
        content: row.title,
        model: null,
        embedding: null,
      });
    }
  }
  await insertChunked(statsEmbeddings, embeddingValues);

  console.log(`[hr] stats_homeruns=${all.length} title-embeddings=${embeddingValues.length}`);
}

async function main() {
  console.log('[phase A] reference tables');
  const maps = await loadReference();

  console.log('[phase B] per-game flatten');
  const files = feedFiles();
  const totals = { plays: 0, pitches: 0, runners: 0, batting: 0, pitching: 0, fielding: 0, linescore: 0, officials: 0 };
  let done = 0;
  let failed = 0;
  for (const file of files) {
    try {
      const feed = readFeed(file);
      const r = await loadGame(feed, maps);
      totals.plays += r.plays;
      totals.pitches += r.pitches;
      totals.runners += r.runners;
      totals.batting += r.batting;
      totals.pitching += r.pitching;
      totals.fielding += r.fielding;
      totals.linescore += r.linescore;
      totals.officials += r.officials;
    } catch (err) {
      failed += 1;
      console.error(`[game] FAILED ${file}: ${(err as Error).message}`);
    }
    done += 1;
    if (done % 200 === 0) {
      console.log(`[phase B] ${done}/${files.length} games (plays=${totals.plays} pitches=${totals.pitches})`);
    }
  }

  console.log('[phase C] homeruns bridge');
  await loadHomeruns();

  console.log(JSON.stringify({ games: done, failed, ...totals }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
