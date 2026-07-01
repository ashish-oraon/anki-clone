import Dexie from "dexie";

export const db = new Dexie("flashcardMvp");

db.version(1).stores({
  decks: "id, name, createdAt, updatedAt",
  cards: "id, deckId, createdAt, updatedAt, suspended",
  reviewStates: "cardId, dueAt",
  reviewLogs: "id, cardId, rating, reviewedAt",
});
