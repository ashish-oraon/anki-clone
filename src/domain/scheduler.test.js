import { describe, expect, it } from "vitest";
import { createInitialReviewState, isDue, RATINGS, scheduleReview } from "./scheduler";

const NOW = new Date("2026-07-01T09:00:00.000Z");

describe("scheduler", () => {
  it("creates new cards as immediately due", () => {
    const state = createInitialReviewState("card-1", NOW);

    expect(state.dueAt).toBe(NOW.toISOString());
    expect(isDue(state, NOW)).toBe(true);
    expect(state.easeFactor).toBe(2.5);
  });

  it("schedules a first good review for tomorrow", () => {
    const state = createInitialReviewState("card-1", NOW);
    const { reviewState, reviewLog } = scheduleReview(state, RATINGS.GOOD, NOW);

    expect(reviewState.intervalDays).toBe(1);
    expect(reviewState.repetitions).toBe(1);
    expect(reviewState.lapses).toBe(0);
    expect(reviewLog.rating).toBe(RATINGS.GOOD);
    expect(reviewLog.previousDueAt).toBe(NOW.toISOString());
  });

  it("resets repetitions and schedules a short retry on again", () => {
    const learnedState = {
      ...createInitialReviewState("card-1", NOW),
      intervalDays: 3,
      repetitions: 2,
    };

    const { reviewState } = scheduleReview(learnedState, RATINGS.AGAIN, NOW);

    expect(reviewState.intervalDays).toBe(0);
    expect(reviewState.repetitions).toBe(0);
    expect(reviewState.lapses).toBe(1);
    expect(reviewState.dueAt).toBe("2026-07-01T09:10:00.000Z");
  });

  it("grows intervals faster on easy reviews", () => {
    const state = {
      ...createInitialReviewState("card-1", NOW),
      intervalDays: 4,
      repetitions: 2,
    };

    const { reviewState } = scheduleReview(state, RATINGS.EASY, NOW);

    expect(reviewState.intervalDays).toBe(14);
    expect(reviewState.easeFactor).toBe(2.65);
    expect(reviewState.repetitions).toBe(3);
  });
});
