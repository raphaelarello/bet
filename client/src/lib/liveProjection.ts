import type { LiveMatchData } from '@/hooks/useLiveMatch';
import type { Predictions } from './types';
import { clampNumber, clampPercent, roundNumber } from './utils';

export interface LiveProjection {
  isLiveAdjusted: boolean;
  minute: number;
  displayMinute: number;
  freshnessSeconds: number;
  isFirstHalfOpen: boolean;
  currentHomeGoals: number;
  currentAwayGoals: number;
  currentTotalGoals: number;
  currentHomeCorners: number;
  currentAwayCorners: number;
  currentTotalCorners: number;
  currentHomeCards: number;
  currentAwayCards: number;
  currentTotalCards: number;
  goalPaceIndex: number;
  cornerPaceIndex: number;
  cardPaceIndex: number;
  pressureIndex: number;
  liveExpectedGoalsHome: number;
  liveExpectedGoalsAway: number;
  liveExpectedTotalGoals: number;
  liveExpectedFirstHalfGoals: number | null;
  liveHomeWinProb: number;
  liveDrawProb: number;
  liveAwayWinProb: number;
  liveOver15Prob: number;
  liveOver25Prob: number;
  liveOver35Prob: number;
  liveOver45Prob: number;
  liveUnder25Prob: number;
  liveUnder35Prob: number;
  liveBttsYesProb: number;
  liveHomeToScoreProb: number;
  liveAwayToScoreProb: number;
  liveCleanSheetHomeProb: number;
  liveCleanSheetAwayProb: number;
  liveHome2PlusGoalsProb: number;
  liveAway2PlusGoalsProb: number;
  liveFirstHalfGoalProb: number | null;
  liveFirstHalfOver05Prob: number | null;
  liveFirstHalfOver15Prob: number | null;
  liveSecondHalfGoalProb: number;
  liveExpectedCornersHome: number;
  liveExpectedCornersAway: number;
  liveExpectedTotalCorners: number;
  liveExpectedFirstHalfCorners: number | null;
  liveOver85CornersProb: number;
  liveOver95CornersProb: number;
  liveOver105CornersProb: number;
  liveUnder85CornersProb: number;
  liveUnder105CornersProb: number;
  liveFirstHalfOver35CornersProb: number | null;
  liveFirstHalfOver45CornersProb: number | null;
  liveFirstHalfOver55CornersProb: number | null;
  liveExpectedCardsHome: number;
  liveExpectedCardsAway: number;
  liveExpectedTotalCards: number;
  liveOver35CardsProb: number;
  liveOver45CardsProb: number;
  liveOver55CardsProb: number;
  notes: string[];
}

function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) p *= lambda / i;
  return clampNumber(p, 0, 1);
}

function poissonCdf(lambda: number, maxK: number): number {
  if (maxK < 0) return 0;
  let sum = 0;
  for (let k = 0; k <= maxK; k += 1) sum += poissonProb(lambda, k);
  return clampNumber(sum, 0, 1);
}

function probabilityReachLine(current: number, remainingLambda: number, line: number): number {
  const target = Math.floor(line) + 1;
  const needed = target - current;
  if (needed <= 0) return 100;
  return roundNumber((1 - poissonCdf(remainingLambda, needed - 1)) * 100, 1);
}

function probabilityStayUnder(current: number, remainingLambda: number, line: number): number {
  const maxAllowed = Math.floor(line) - current;
  if (maxAllowed < 0) return 0;
  return roundNumber(poissonCdf(remainingLambda, maxAllowed) * 100, 1);
}

function probabilityTeamEndsAtLeast(current: number, remainingLambda: number, target: number): number {
  const needed = target - current;
  if (needed <= 0) return 100;
  return roundNumber((1 - poissonCdf(remainingLambda, needed - 1)) * 100, 1);
}

function cumulativeShare(minute: number, firstHalfWeight: number): number {
  const m = clampNumber(minute, 0, 90);
  if (m <= 45) return firstHalfWeight * (m / 45);
  return firstHalfWeight + (1 - firstHalfWeight) * ((m - 45) / 45);
}

function ratio(actual: number, expected: number, fallback = 1): number {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) return fallback;
  return actual / expected;
}

function dampenedRatio(actual: number, expected: number, min = 0.45, max = 1.8): number {
  const raw = ratio(actual, expected, 1);
  return clampNumber(Math.sqrt(raw), min, max);
}

function shareOf(a: number, b: number, neutral = 0.5): number {
  const total = a + b;
  if (total <= 0) return neutral;
  return clampNumber(a / total, 0, 1);
}

export function parseLiveClockToMinute(clock: string | null | undefined): number {
  if (!clock) return 0;
  const clean = String(clock).replace(/'/g, '').trim();
  const plus = clean.match(/(\d+)\s*\+\s*(\d+)/);
  if (plus) return Number(plus[1]) + Number(plus[2]);
  const main = clean.match(/(\d+)/);
  return main ? Number(main[1]) : 0;
}

export function deriveLiveProjection(predictions: Predictions, liveData: LiveMatchData | null): LiveProjection | null {
  if (!liveData || !liveData.isLive) return null;

  const displayMinute = parseLiveClockToMinute(liveData.clock);
  const minute = clampNumber(displayMinute, 0, 90);
  const freshnessSeconds = Math.max(0, Math.round((Date.now() - liveData.lastUpdated) / 1000));

  const currentHomeGoals = Number(liveData.homeScore || 0) || 0;
  const currentAwayGoals = Number(liveData.awayScore || 0) || 0;
  const currentTotalGoals = currentHomeGoals + currentAwayGoals;

  const currentHomeCorners = liveData.homeStats.corners || 0;
  const currentAwayCorners = liveData.awayStats.corners || 0;
  const currentTotalCorners = currentHomeCorners + currentAwayCorners;

  const currentHomeCards = (liveData.homeStats.yellowCards || 0) + (liveData.homeStats.redCards || 0) * 2;
  const currentAwayCards = (liveData.awayStats.yellowCards || 0) + (liveData.awayStats.redCards || 0) * 2;
  const currentTotalCards = currentHomeCards + currentAwayCards;

  const totalShots = (liveData.homeStats.shots || 0) + (liveData.awayStats.shots || 0);
  const totalShotsOnTarget = (liveData.homeStats.shotsOnTarget || 0) + (liveData.awayStats.shotsOnTarget || 0);
  const totalFouls = (liveData.homeStats.fouls || 0) + (liveData.awayStats.fouls || 0);
  const totalRedCards = (liveData.homeStats.redCards || 0) + (liveData.awayStats.redCards || 0);
  const goalDiff = currentHomeGoals - currentAwayGoals;

  const goalShareNow = cumulativeShare(minute, 0.42);
  const cornerShareNow = cumulativeShare(minute, 0.46);
  const cardShareNow = cumulativeShare(minute, 0.4);

  const expectedShotsFull = clampNumber(predictions.expectedTotalGoals * 7.2, 15, 30);
  const expectedShotsOnTargetFull = clampNumber(predictions.expectedTotalGoals * 2.7, 4.5, 12);
  const expectedFoulsFull = clampNumber(predictions.expectedCards * 6.5, 16, 34);

  const goalPaceIndex = dampenedRatio(totalShots, expectedShotsFull * Math.max(goalShareNow, 0.12), 0.45, 1.85) * 0.45
    + dampenedRatio(totalShotsOnTarget, expectedShotsOnTargetFull * Math.max(goalShareNow, 0.12), 0.45, 2.0) * 0.4
    + dampenedRatio(currentTotalCorners, predictions.expectedCorners * Math.max(cornerShareNow, 0.14), 0.5, 1.8) * 0.15;

  const cornerExpectedSoFar = predictions.expectedCorners * Math.max(cornerShareNow, minute <= 20 ? 0.22 : minute <= 35 ? 0.18 : 0.14);
  const cornerPaceCeiling = minute <= 20 ? 1.28 : minute <= 35 ? 1.45 : minute <= 55 ? 1.68 : 1.82;
  const earlyCornerDamping = minute <= 15 ? 0.76 : minute <= 25 ? 0.84 : minute <= 35 ? 0.92 : 1;
  const cornerPaceIndex = clampNumber(
    dampenedRatio(currentTotalCorners, cornerExpectedSoFar, 0.62, cornerPaceCeiling) * 0.72
      + dampenedRatio(totalShots, expectedShotsFull * Math.max(goalShareNow, 0.16), 0.68, 1.5) * 0.18
      + dampenedRatio(totalShotsOnTarget, expectedShotsOnTargetFull * Math.max(goalShareNow, 0.16), 0.72, 1.55) * 0.1,
    0.62,
    cornerPaceCeiling,
  ) * earlyCornerDamping;

  const cardPaceIndex = dampenedRatio(currentTotalCards, predictions.expectedCards * Math.max(cardShareNow, 0.12), 0.45, 2.1) * 0.7
    + dampenedRatio(totalFouls, expectedFoulsFull * Math.max(cardShareNow, 0.12), 0.55, 1.9) * 0.3;

  const shotShareHome = shareOf(liveData.homeStats.shots || 0, liveData.awayStats.shots || 0, predictions.expectedGoalsHome / Math.max(predictions.expectedTotalGoals, 0.01));
  const onTargetShareHome = shareOf(liveData.homeStats.shotsOnTarget || 0, liveData.awayStats.shotsOnTarget || 0, predictions.expectedGoalsHome / Math.max(predictions.expectedTotalGoals, 0.01));
  const cornerShareHome = shareOf(currentHomeCorners, currentAwayCorners, predictions.expectedCornersHome / Math.max(predictions.expectedCorners, 0.01));
  const cardShareHome = shareOf(currentHomeCards, currentAwayCards, predictions.expectedCardsHome / Math.max(predictions.expectedCards, 0.01));
  const possessionShareHome = clampNumber((liveData.homeStats.possession || 50) / 100, 0.2, 0.8);
  const baseGoalShareHome = clampNumber(predictions.expectedGoalsHome / Math.max(predictions.expectedTotalGoals, 0.01), 0.15, 0.85);
  const baseCornerShareHome = clampNumber(predictions.expectedCornersHome / Math.max(predictions.expectedCorners, 0.01), 0.18, 0.82);
  const baseCardShareHome = clampNumber(predictions.expectedCardsHome / Math.max(predictions.expectedCards, 0.01), 0.18, 0.82);

  const scoreContextShift =
    goalDiff < 0 ? 0.06 :
    goalDiff > 0 ? -0.04 :
    0;
  const awayRedAdvantage = (liveData.awayStats.redCards || 0) - (liveData.homeStats.redCards || 0);
  const homeRedPenalty = (liveData.homeStats.redCards || 0) - (liveData.awayStats.redCards || 0);

  const homeGoalShareLive = clampNumber(
    baseGoalShareHome * 0.45 + (shotShareHome * 0.22 + onTargetShareHome * 0.33 + cornerShareHome * 0.15 + possessionShareHome * 0.3) * 0.55 + scoreContextShift + awayRedAdvantage * 0.05 - homeRedPenalty * 0.05,
    0.12,
    0.88,
  );

  const homeCornerShareLive = clampNumber(
    baseCornerShareHome * 0.35 + (cornerShareHome * 0.45 + shotShareHome * 0.2 + possessionShareHome * 0.2 + onTargetShareHome * 0.15) * 0.65,
    0.12,
    0.88,
  );

  const homeCardShareLive = clampNumber(
    baseCardShareHome * 0.4 + (cardShareHome * 0.45 + possessionShareHome * 0.1 + (goalDiff > 0 ? 0.42 : goalDiff < 0 ? 0.58 : 0.5) * 0.05) * 0.6,
    0.12,
    0.88,
  );

  const goalsRemainingBase = predictions.expectedTotalGoals * (1 - goalShareNow);
  const cornersRemainingBase = predictions.expectedCorners * (1 - cornerShareNow);
  const cardsRemainingBase = predictions.expectedCards * (1 - cardShareNow);

  let goalsStateFactor = 1;
  if (minute >= 55 && Math.abs(goalDiff) >= 2) goalsStateFactor *= 0.84;
  else if (minute >= 55 && Math.abs(goalDiff) === 1) goalsStateFactor *= 1.04;
  if (minute >= 70 && goalDiff === 0) goalsStateFactor *= 1.08;
  if (totalRedCards > 0) goalsStateFactor *= 1 + Math.min(totalRedCards, 2) * 0.07;

  let cornersStateFactor = 1;
  if (minute >= 65 && Math.abs(goalDiff) >= 2) cornersStateFactor *= 0.9;
  else if (minute >= 65 && Math.abs(goalDiff) <= 1) cornersStateFactor *= 1.06;

  let cardsStateFactor = 1;
  if (minute >= 60 && Math.abs(goalDiff) <= 1) cardsStateFactor *= 1.08;
  if (minute >= 75) cardsStateFactor *= 1.04;
  if (totalRedCards > 0) cardsStateFactor *= 0.95;

  const liveGoalsRemaining = clampNumber(goalsRemainingBase * clampNumber(goalPaceIndex, 0.45, 1.95) * goalsStateFactor, 0.02, 6);
  const liveCornersRemaining = clampNumber(
    cornersRemainingBase * clampNumber(cornerPaceIndex, 0.62, minute <= 25 ? 1.24 : minute <= 45 ? 1.5 : 1.82) * cornersStateFactor,
    0.1,
    minute <= 20 ? 6.2 : minute <= 45 ? 8.5 : 10,
  );
  const liveCardsRemaining = clampNumber(cardsRemainingBase * clampNumber(cardPaceIndex, 0.45, 2.05) * cardsStateFactor, 0.05, 8);

  const liveExpectedGoalsHome = roundNumber(currentHomeGoals + liveGoalsRemaining * homeGoalShareLive, 2);
  const liveExpectedGoalsAway = roundNumber(currentAwayGoals + liveGoalsRemaining * (1 - homeGoalShareLive), 2);
  const liveExpectedTotalGoals = roundNumber(currentTotalGoals + liveGoalsRemaining, 2);

  const liveExpectedCornersHome = roundNumber(currentHomeCorners + liveCornersRemaining * homeCornerShareLive, 1);
  const liveExpectedCornersAway = roundNumber(currentAwayCorners + liveCornersRemaining * (1 - homeCornerShareLive), 1);
  const liveExpectedTotalCorners = roundNumber(currentTotalCorners + liveCornersRemaining, 1);

  const liveExpectedCardsHome = roundNumber(currentHomeCards + liveCardsRemaining * homeCardShareLive, 1);
  const liveExpectedCardsAway = roundNumber(currentAwayCards + liveCardsRemaining * (1 - homeCardShareLive), 1);
  const liveExpectedTotalCards = roundNumber(currentTotalCards + liveCardsRemaining, 1);

  const homeRemainingGoals = liveGoalsRemaining * homeGoalShareLive;
  const awayRemainingGoals = liveGoalsRemaining * (1 - homeGoalShareLive);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (let addHome = 0; addHome <= 8; addHome += 1) {
    for (let addAway = 0; addAway <= 8; addAway += 1) {
      const prob = poissonProb(homeRemainingGoals, addHome) * poissonProb(awayRemainingGoals, addAway);
      const finalHome = currentHomeGoals + addHome;
      const finalAway = currentAwayGoals + addAway;
      if (finalHome > finalAway) homeWin += prob;
      else if (finalHome < finalAway) awayWin += prob;
      else draw += prob;
    }
  }

  const resultTotal = homeWin + draw + awayWin || 1;
  const liveHomeWinProb = roundNumber((homeWin / resultTotal) * 100, 1);
  const liveDrawProb = roundNumber((draw / resultTotal) * 100, 1);
  const liveAwayWinProb = roundNumber(100 - liveHomeWinProb - liveDrawProb, 1);

  const isFirstHalfOpen = displayMinute < 45 && liveData.period <= 1;
  const firstHalfRemainingFactor = isFirstHalfOpen ? clampNumber((45 - displayMinute) / 45, 0, 1) : 0;
  const firstHalfGoalsPace = clampNumber(goalPaceIndex * (displayMinute <= 30 ? 1.02 : 0.96), 0.4, 2.1);
  const firstHalfCornersPace = clampNumber(cornerPaceIndex * (displayMinute <= 30 ? 1.04 : 0.95), 0.45, 2.2);

  const firstHalfGoalsRemaining = isFirstHalfOpen
    ? clampNumber(predictions.expectedFirstHalfGoals * firstHalfRemainingFactor * firstHalfGoalsPace, 0.02, 3.5)
    : 0;
  const firstHalfCornersRemaining = isFirstHalfOpen
    ? clampNumber(predictions.expectedFirstHalfCorners * firstHalfRemainingFactor * firstHalfCornersPace, 0.05, 7)
    : 0;

  const liveExpectedFirstHalfGoals = isFirstHalfOpen ? roundNumber(currentTotalGoals + firstHalfGoalsRemaining, 2) : null;
  const liveExpectedFirstHalfCorners = isFirstHalfOpen ? roundNumber(currentTotalCorners + firstHalfCornersRemaining, 1) : null;

  const pressureIndex = Math.round(clampNumber(
    goalPaceIndex * 38 + cornerPaceIndex * 30 + (shareOf(totalShotsOnTarget, expectedShotsOnTargetFull * Math.max(goalShareNow, 0.12), 1) * 20) + (displayMinute > 0 ? 12 : 0),
    0,
    100,
  ));

  const notes: string[] = [];
  if (goalPaceIndex >= 1.2) notes.push('pressão ofensiva acima da projeção pré-jogo');
  else if (goalPaceIndex <= 0.82) notes.push('volume de finalizações abaixo do esperado');
  if (cornerPaceIndex >= 1.18) notes.push('ritmo de escanteios acelerado');
  if (cardPaceIndex >= 1.15) notes.push('intensidade disciplinar acima da média');
  if (displayMinute >= 60 && goalDiff === 0) notes.push('empate tardio costuma forçar mais risco no trecho final');

  return {
    isLiveAdjusted: true,
    minute,
    displayMinute,
    freshnessSeconds,
    isFirstHalfOpen,
    currentHomeGoals,
    currentAwayGoals,
    currentTotalGoals,
    currentHomeCorners,
    currentAwayCorners,
    currentTotalCorners,
    currentHomeCards,
    currentAwayCards,
    currentTotalCards,
    goalPaceIndex: roundNumber(goalPaceIndex, 2),
    cornerPaceIndex: roundNumber(cornerPaceIndex, 2),
    cardPaceIndex: roundNumber(cardPaceIndex, 2),
    pressureIndex,
    liveExpectedGoalsHome,
    liveExpectedGoalsAway,
    liveExpectedTotalGoals,
    liveExpectedFirstHalfGoals,
    liveHomeWinProb,
    liveDrawProb,
    liveAwayWinProb,
    liveOver15Prob: probabilityReachLine(currentTotalGoals, liveGoalsRemaining, 1.5),
    liveOver25Prob: probabilityReachLine(currentTotalGoals, liveGoalsRemaining, 2.5),
    liveOver35Prob: probabilityReachLine(currentTotalGoals, liveGoalsRemaining, 3.5),
    liveOver45Prob: probabilityReachLine(currentTotalGoals, liveGoalsRemaining, 4.5),
    liveUnder25Prob: probabilityStayUnder(currentTotalGoals, liveGoalsRemaining, 2.5),
    liveUnder35Prob: probabilityStayUnder(currentTotalGoals, liveGoalsRemaining, 3.5),
    liveBttsYesProb: roundNumber(
      currentHomeGoals > 0 && currentAwayGoals > 0
        ? 100
        : currentHomeGoals > 0
          ? (1 - poissonProb(awayRemainingGoals, 0)) * 100
          : currentAwayGoals > 0
            ? (1 - poissonProb(homeRemainingGoals, 0)) * 100
            : (1 - poissonProb(homeRemainingGoals, 0)) * (1 - poissonProb(awayRemainingGoals, 0)) * 100,
      1,
    ),
    liveHomeToScoreProb: roundNumber(currentHomeGoals > 0 ? 100 : (1 - poissonProb(homeRemainingGoals, 0)) * 100, 1),
    liveAwayToScoreProb: roundNumber(currentAwayGoals > 0 ? 100 : (1 - poissonProb(awayRemainingGoals, 0)) * 100, 1),
    liveCleanSheetHomeProb: roundNumber(currentAwayGoals > 0 ? 0 : poissonProb(awayRemainingGoals, 0) * 100, 1),
    liveCleanSheetAwayProb: roundNumber(currentHomeGoals > 0 ? 0 : poissonProb(homeRemainingGoals, 0) * 100, 1),
    liveHome2PlusGoalsProb: probabilityTeamEndsAtLeast(currentHomeGoals, homeRemainingGoals, 2),
    liveAway2PlusGoalsProb: probabilityTeamEndsAtLeast(currentAwayGoals, awayRemainingGoals, 2),
    liveFirstHalfGoalProb: isFirstHalfOpen ? probabilityReachLine(currentTotalGoals, firstHalfGoalsRemaining, 0.5) : null,
    liveFirstHalfOver05Prob: isFirstHalfOpen ? probabilityReachLine(currentTotalGoals, firstHalfGoalsRemaining, 0.5) : null,
    liveFirstHalfOver15Prob: isFirstHalfOpen ? probabilityReachLine(currentTotalGoals, firstHalfGoalsRemaining, 1.5) : null,
    liveSecondHalfGoalProb: probabilityReachLine(0, liveGoalsRemaining, 0.5),
    liveExpectedCornersHome,
    liveExpectedCornersAway,
    liveExpectedTotalCorners,
    liveExpectedFirstHalfCorners,
    liveOver85CornersProb: probabilityReachLine(currentTotalCorners, liveCornersRemaining, 8.5),
    liveOver95CornersProb: probabilityReachLine(currentTotalCorners, liveCornersRemaining, 9.5),
    liveOver105CornersProb: probabilityReachLine(currentTotalCorners, liveCornersRemaining, 10.5),
    liveUnder85CornersProb: probabilityStayUnder(currentTotalCorners, liveCornersRemaining, 8.5),
    liveUnder105CornersProb: probabilityStayUnder(currentTotalCorners, liveCornersRemaining, 10.5),
    liveFirstHalfOver35CornersProb: isFirstHalfOpen ? probabilityReachLine(currentTotalCorners, firstHalfCornersRemaining, 3.5) : null,
    liveFirstHalfOver45CornersProb: isFirstHalfOpen ? probabilityReachLine(currentTotalCorners, firstHalfCornersRemaining, 4.5) : null,
    liveFirstHalfOver55CornersProb: isFirstHalfOpen ? probabilityReachLine(currentTotalCorners, firstHalfCornersRemaining, 5.5) : null,
    liveExpectedCardsHome,
    liveExpectedCardsAway,
    liveExpectedTotalCards,
    liveOver35CardsProb: probabilityReachLine(currentTotalCards, liveCardsRemaining, 3.5),
    liveOver45CardsProb: probabilityReachLine(currentTotalCards, liveCardsRemaining, 4.5),
    liveOver55CardsProb: probabilityReachLine(currentTotalCards, liveCardsRemaining, 5.5),
    notes,
  };
}
