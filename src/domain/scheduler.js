export const RATINGS = {
  AGAIN: "again",
  HARD: "hard",
  GOOD: "good",
  EASY: "easy",
};

export const RATING_LABELS = {
  [RATINGS.AGAIN]: "Again",
  [RATINGS.HARD]: "Hard",
  [RATINGS.GOOD]: "Good",
  [RATINGS.EASY]: "Easy",
};

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const AGAIN_DELAY_MINUTES = 10;

export function createInitialReviewState(cardId, now = new Date()) {
  return {
    cardId,
    dueAt: now.toISOString(),
    intervalDays: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

export function isDue(reviewState, now = new Date()) {
  return new Date(reviewState.dueAt).getTime() <= now.getTime();
}

export function scheduleReview(reviewState, rating, now = new Date()) {
  if (!Object.values(RATINGS).includes(rating)) {
    throw new Error(`Unsupported review rating: ${rating}`);
  }

  const previousDueAt = reviewState.dueAt;
  const nextState = calculateNextState(reviewState, rating, now);

  return {
    reviewState: nextState,
    reviewLog: {
      id: crypto.randomUUID(),
      cardId: reviewState.cardId,
      rating,
      reviewedAt: now.toISOString(),
      previousDueAt,
      nextDueAt: nextState.dueAt,
    },
  };
}

function calculateNextState(reviewState, rating, now) {
  const currentEase = reviewState.easeFactor ?? DEFAULT_EASE_FACTOR;
  const currentInterval = reviewState.intervalDays ?? 0;
  const currentRepetitions = reviewState.repetitions ?? 0;

  if (rating === RATINGS.AGAIN) {
    return {
      ...reviewState,
      dueAt: addMinutes(now, AGAIN_DELAY_MINUTES).toISOString(),
      intervalDays: 0,
      easeFactor: clampEase(currentEase - 0.2),
      repetitions: 0,
      lapses: (reviewState.lapses ?? 0) + 1,
      lastReviewedAt: now.toISOString(),
    };
  }

  const easeDelta = rating === RATINGS.HARD ? -0.15 : rating === RATINGS.EASY ? 0.15 : 0;
  const nextEase = clampEase(currentEase + easeDelta);
  const nextInterval = getNextIntervalDays(currentInterval, currentRepetitions, nextEase, rating);

  return {
    ...reviewState,
    dueAt: addDays(now, nextInterval).toISOString(),
    intervalDays: nextInterval,
    easeFactor: nextEase,
    repetitions: currentRepetitions + 1,
    lastReviewedAt: now.toISOString(),
  };
}

function getNextIntervalDays(currentInterval, repetitions, easeFactor, rating) {
  if (rating === RATINGS.HARD) {
    return Math.max(1, Math.round(Math.max(currentInterval, 1) * 1.2));
  }

  if (rating === RATINGS.EASY) {
    if (repetitions === 0) {
      return 4;
    }

    return Math.max(2, Math.round(Math.max(currentInterval, 1) * easeFactor * 1.3));
  }

  if (repetitions === 0) {
    return 1;
  }

  if (repetitions === 1) {
    return 3;
  }

  return Math.max(1, Math.round(Math.max(currentInterval, 1) * easeFactor));
}

function clampEase(easeFactor) {
  return Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMinutes(date, minutes) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}
