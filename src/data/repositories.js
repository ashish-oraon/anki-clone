import { db } from "./db";
import { createInitialReviewState, isDue, scheduleReview } from "../domain/scheduler";
import seedData from "../assets/seedDecks.json";
import telcA21SeedData from "../assets/einfachGutA21SeedDecks.json";
import telcA22SeedData from "../assets/einfachGutA22SeedDecks.json";

const seedDecks = [...seedData.decks, ...telcA21SeedData.decks, ...telcA22SeedData.decks];

export async function initializeDatabaseFromSeed() {
  const [deckCount, cardCount] = await Promise.all([db.decks.count(), db.cards.count()]);

  if (deckCount > 0 || cardCount > 0) {
    return false;
  }

  const { decks, cards, reviewStates } = buildSeedRecords();

  await db.transaction("rw", db.decks, db.cards, db.reviewStates, async () => {
    await db.decks.bulkPut(decks);
    await db.cards.bulkPut(cards);
    await db.reviewStates.bulkPut(reviewStates);
  });

  return true;
}

export async function resetDatabaseFromSeed() {
  const { decks, cards, reviewStates } = buildSeedRecords();

  await db.transaction("rw", db.decks, db.cards, db.reviewStates, db.reviewLogs, async () => {
    await Promise.all([db.reviewLogs.clear(), db.reviewStates.clear(), db.cards.clear(), db.decks.clear()]);
    await db.decks.bulkPut(decks);
    await db.cards.bulkPut(cards);
    await db.reviewStates.bulkPut(reviewStates);
  });
}

export async function getDashboard() {
  const [decks, cards, reviewStates, reviewLogs] = await Promise.all([
    db.decks.orderBy("createdAt").toArray(),
    db.cards.toArray(),
    db.reviewStates.toArray(),
    db.reviewLogs.toArray(),
  ]);

  const now = new Date();
  const todayKey = getDateKey(now);

  return decks.map((deck) => {
    const deckCards = cards.filter((card) => card.deckId === deck.id);
    const deckCardIds = new Set(deckCards.map((card) => card.id));
    const reviewStatesByCardId = new Map(
      reviewStates.filter((state) => deckCardIds.has(state.cardId)).map((state) => [state.cardId, state]),
    );

    return {
      ...deck,
      totalCards: deckCards.length,
      dueCards: deckCards.filter((card) => {
        const reviewState = reviewStatesByCardId.get(card.id);
        return !card.suspended && reviewState && isDue(reviewState, now);
      }).length,
      reviewedToday: reviewLogs.filter(
        (log) => deckCardIds.has(log.cardId) && getDateKey(new Date(log.reviewedAt)) === todayKey,
      ).length,
    };
  });
}

export async function createDeck({ name, description = "" }) {
  const now = new Date().toISOString();
  const deck = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await db.decks.add(deck);
  return deck;
}

export async function updateDeck(deckId, updates) {
  await db.decks.update(deckId, {
    ...updates,
    name: updates.name?.trim(),
    description: updates.description?.trim() ?? "",
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDeck(deckId) {
  const cardIds = await db.cards.where("deckId").equals(deckId).primaryKeys();

  await db.transaction("rw", db.decks, db.cards, db.reviewStates, db.reviewLogs, async () => {
    await db.decks.delete(deckId);
    await db.cards.where("deckId").equals(deckId).delete();

    if (cardIds.length > 0) {
      await db.reviewStates.bulkDelete(cardIds);
      await db.reviewLogs.where("cardId").anyOf(cardIds).delete();
    }
  });
}

export async function getDeck(deckId) {
  return db.decks.get(deckId);
}

export async function getCardsForDeck(deckId) {
  return db.cards.where("deckId").equals(deckId).sortBy("createdAt");
}

export async function createCard({ deckId, front, back }) {
  const now = new Date();
  const nowIso = now.toISOString();
  const card = {
    id: crypto.randomUUID(),
    deckId,
    front: front.trim(),
    back: back.trim(),
    suspended: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await db.transaction("rw", db.cards, db.reviewStates, async () => {
    await db.cards.add(card);
    await db.reviewStates.add(createInitialReviewState(card.id, now));
  });

  return card;
}

export async function updateCard(cardId, updates) {
  await db.cards.update(cardId, {
    ...updates,
    front: updates.front?.trim(),
    back: updates.back?.trim(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCard(cardId) {
  await db.transaction("rw", db.cards, db.reviewStates, db.reviewLogs, async () => {
    await db.cards.delete(cardId);
    await db.reviewStates.delete(cardId);
    await db.reviewLogs.where("cardId").equals(cardId).delete();
  });
}

export async function getDueCards(deckId) {
  const cards = await db.cards.where("deckId").equals(deckId).toArray();
  const activeCards = cards.filter((card) => !card.suspended);
  const reviewStates = await db.reviewStates.bulkGet(activeCards.map((card) => card.id));
  const now = new Date();

  return activeCards
    .map((card, index) => ({
      card,
      reviewState: reviewStates[index],
    }))
    .filter(({ reviewState }) => reviewState && isDue(reviewState, now))
    .sort((a, b) => new Date(a.reviewState.dueAt).getTime() - new Date(b.reviewState.dueAt).getTime());
}

export async function getPracticeCards(deckId) {
  const cards = await db.cards.where("deckId").equals(deckId).sortBy("createdAt");

  return cards.filter((card) => !card.suspended).map((card) => ({ card, reviewState: null }));
}

export async function reviewCard(cardId, rating) {
  const reviewState = await db.reviewStates.get(cardId);

  if (!reviewState) {
    throw new Error("Review state was not found for this card.");
  }

  const { reviewState: nextReviewState, reviewLog } = scheduleReview(reviewState, rating);

  await db.transaction("rw", db.reviewStates, db.reviewLogs, async () => {
    await db.reviewStates.put(nextReviewState);
    await db.reviewLogs.add(reviewLog);
  });

  return nextReviewState;
}

function getDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildSeedRecords() {
  const now = new Date();
  const nowIso = now.toISOString();
  const decks = seedDecks.map((deck) => ({
    id: deck.id,
    name: deck.name.trim(),
    description: deck.description?.trim() ?? "",
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  const cards = seedDecks.flatMap((deck) =>
    deck.cards.map((card) => ({
      id: card.id,
      deckId: deck.id,
      front: card.front.trim(),
      back: card.back.trim(),
      suspended: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    })),
  );
  const reviewStates = cards.map((card) => createInitialReviewState(card.id, now));

  return { decks, cards, reviewStates };
}
