import { and, eq, inArray } from 'drizzle-orm';
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

// One real 2024 game (OAK @ PHI, 2024-07-14) whose plays include home runs that
// also exist in the legacy `homeruns` table, so the slice exercises hitData and
// the homeruns bridge.
const DEFAULT_GAME_PK = 745551;

// biome-ignore lint/suspicious/noExplicitAny: StatsAPI feed is untyped JSON.
type Json = any;

const gamePk = Number(process.argv[2] ?? DEFAULT_GAME_PK);

async function fetchFeed(pk: number): Promise<Json> {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`StatsAPI ${pk} -> ${res.status} ${res.statusText}`);
  return res.json();
}

// Remove any prior rows for this game so re-runs are idempotent even on the
// tables that have no natural unique key (runners, officials, homeruns bridge).
async function cleanupGame(gameId: string) {
  const playRows = await db.select({ id: statsPlays.id }).from(statsPlays).where(eq(statsPlays.gameId, gameId));
  const playIds = playRows.map((r) => r.id);

  const pitchRows = await db
    .select({ playId: statsPitches.playId })
    .from(statsPitches)
    .where(eq(statsPitches.gameId, gameId));
  const hrPlayIds = pitchRows.map((r) => r.playId).filter((p): p is string => !!p);

  const hrRows = hrPlayIds.length
    ? await db.select({ id: statsHomeruns.id }).from(statsHomeruns).where(inArray(statsHomeruns.playId, hrPlayIds))
    : [];
  const hrIds = hrRows.map((r) => r.id);

  if (playIds.length) {
    await db
      .delete(statsEmbeddings)
      .where(and(inArray(statsEmbeddings.sourceId, playIds), eq(statsEmbeddings.sourceTable, 'stats_plays')));
  }
  if (hrIds.length) {
    await db.delete(statsEmbeddings).where(inArray(statsEmbeddings.sourceId, hrIds));
  }
  if (hrPlayIds.length) await db.delete(statsHomeruns).where(inArray(statsHomeruns.playId, hrPlayIds));

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

async function main() {
  const feed = await fetchFeed(gamePk);
  const gameData: Json = feed.gameData;
  const liveData: Json = feed.liveData;

  // --- reference: teams -------------------------------------------------
  const teamObjs: Json[] = [gameData.teams.away, gameData.teams.home];
  await db
    .insert(statsTeams)
    .values(
      teamObjs.map((t) => ({
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
      })),
    )
    .onConflictDoNothing();
  const teamRows = await db
    .select({ id: statsTeams.id, mlbId: statsTeams.mlbId })
    .from(statsTeams)
    .where(
      inArray(
        statsTeams.mlbId,
        teamObjs.map((t) => t.id),
      ),
    );
  const teamMap = new Map<number, string>(teamRows.map((r) => [r.mlbId, r.id]));

  // --- reference: venue -------------------------------------------------
  const v: Json = gameData.venue;
  await db
    .insert(statsVenues)
    .values({
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
    })
    .onConflictDoNothing();
  const venueRows = await db
    .select({ id: statsVenues.id, mlbId: statsVenues.mlbId })
    .from(statsVenues)
    .where(eq(statsVenues.mlbId, v.id));
  const venueMap = new Map<number, string>(venueRows.map((r) => [r.mlbId, r.id]));

  // --- reference: people ------------------------------------------------
  const peopleObjs: Json[] = Object.values(gameData.players ?? {});
  if (peopleObjs.length) {
    await db
      .insert(statsPeople)
      .values(
        peopleObjs.map((p) => ({
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
        })),
      )
      .onConflictDoNothing();
  }
  const peopleRows = await db
    .select({ id: statsPeople.id, mlbId: statsPeople.mlbId })
    .from(statsPeople)
    .where(
      inArray(
        statsPeople.mlbId,
        peopleObjs.map((p) => p.id),
      ),
    );
  const peopleMap = new Map<number, string>(peopleRows.map((r) => [r.mlbId, r.id]));
  const person = (id: number | undefined | null) => (id == null ? undefined : peopleMap.get(id));

  // Idempotent: clear any prior copy of this game before re-inserting.
  const prior = await db.select({ id: statsGames.id }).from(statsGames).where(eq(statsGames.gamePk, gamePk));
  if (prior[0]) await cleanupGame(prior[0].id);

  // --- game -------------------------------------------------------------
  const decisions: Json = liveData.decisions ?? {};
  const ls: Json = liveData.linescore ?? {};
  const [gameRow] = await db
    .insert(statsGames)
    .values({
      gamePk,
      gameGuid: gameData.game?.id,
      season: gameData.game?.season != null ? Number(gameData.game.season) : undefined,
      gameType: gameData.game?.type,
      gameDate: gameData.datetime?.dateTime,
      officialDate: gameData.datetime?.officialDate,
      awayTeamId: teamMap.get(gameData.teams.away.id),
      homeTeamId: teamMap.get(gameData.teams.home.id),
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

  // --- plays ------------------------------------------------------------
  const allPlays: Json[] = liveData.plays?.allPlays ?? [];
  if (allPlays.length) {
    await db
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
      .onConflictDoNothing();
  }
  const playRows = await db
    .select({ id: statsPlays.id, atBatIndex: statsPlays.atBatIndex })
    .from(statsPlays)
    .where(eq(statsPlays.gameId, gameId));
  const playMap = new Map<number, string>(
    playRows.filter((r) => r.atBatIndex != null).map((r) => [r.atBatIndex as number, r.id]),
  );

  // --- pitches ----------------------------------------------------------
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
  if (pitchValues.length) await db.insert(statsPitches).values(pitchValues).onConflictDoNothing();

  // --- runners ----------------------------------------------------------
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
  if (runnerValues.length) await db.insert(statsRunners).values(runnerValues).onConflictDoNothing();

  // --- boxscore: batting / pitching / fielding --------------------------
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
  if (battingValues.length) await db.insert(statsGameBatting).values(battingValues).onConflictDoNothing();
  if (pitchingValues.length) await db.insert(statsGamePitching).values(pitchingValues).onConflictDoNothing();
  if (fieldingValues.length) await db.insert(statsGameFielding).values(fieldingValues).onConflictDoNothing();

  // --- linescore --------------------------------------------------------
  const innings: Json[] = ls.innings ?? [];
  if (innings.length) {
    await db
      .insert(statsLinescore)
      .values(
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
      )
      .onConflictDoNothing();
  }

  // --- officials --------------------------------------------------------
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

  // --- homeruns bridge --------------------------------------------------
  const insertedPitches = await db
    .select({ playId: statsPitches.playId })
    .from(statsPitches)
    .where(eq(statsPitches.gameId, gameId));
  const pitchPlayIds = insertedPitches.map((r) => r.playId).filter((p): p is string => !!p);
  const matchingHrs = pitchPlayIds.length
    ? await db.select().from(homeruns).where(inArray(homeruns.playId, pitchPlayIds))
    : [];
  if (matchingHrs.length) {
    await db.insert(statsHomeruns).values(
      matchingHrs.map((h) => ({
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
  }

  // --- embeddings (staged, vectors stay NULL — no OpenAI) ---------------
  const playDescs = await db
    .select({ id: statsPlays.id, description: statsPlays.description })
    .from(statsPlays)
    .where(eq(statsPlays.gameId, gameId));
  const embeddingValues: Json[] = [];
  for (const row of playDescs) {
    if (row.description && row.description.trim() !== '') {
      embeddingValues.push({
        sourceTable: 'stats_plays',
        sourceId: row.id,
        columnName: 'description',
        content: row.description,
        model: null,
        embedding: null,
      });
    }
  }
  const hrTitles = pitchPlayIds.length
    ? await db
        .select({ id: statsHomeruns.id, title: statsHomeruns.title })
        .from(statsHomeruns)
        .where(inArray(statsHomeruns.playId, pitchPlayIds))
    : [];
  for (const row of hrTitles) {
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
  if (embeddingValues.length) await db.insert(statsEmbeddings).values(embeddingValues).onConflictDoNothing();

  console.log(
    JSON.stringify(
      {
        gamePk,
        gameId,
        teams: teamMap.size,
        venues: venueMap.size,
        people: peopleMap.size,
        plays: playRows.length,
        pitches: pitchValues.length,
        runners: runnerValues.length,
        batting: battingValues.length,
        pitching: pitchingValues.length,
        fielding: fieldingValues.length,
        linescore: innings.length,
        officials: officials.length,
        homeruns: matchingHrs.length,
        embeddings: embeddingValues.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
