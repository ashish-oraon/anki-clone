import { useEffect, useMemo, useRef, useState } from "react";
import { RATINGS, RATING_LABELS } from "./domain/scheduler";
import {
  createCard,
  createDeck,
  deleteCard,
  deleteDeck,
  getCardsForDeck,
  getDashboard,
  getDeck,
  getDueCards,
  initializeDatabaseFromSeed,
  reviewCard,
  updateCard,
  updateDeck,
} from "./data/repositories";

const EMPTY_CARD_FORM = { front: "", back: "" };
const EMPTY_DECK_FORM = { name: "", description: "" };

export default function App() {
  const [dashboard, setDashboard] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [isStudying, setIsStudying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const hasInitializedDatabase = useRef(false);

  async function refreshDashboard() {
    setIsLoading(true);
    setError("");

    try {
      if (!hasInitializedDatabase.current) {
        await initializeDatabaseFromSeed();
        hasInitializedDatabase.current = true;
      }

      setDashboard(await getDashboard());
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  const selectedDeck = useMemo(
    () => dashboard.find((deck) => deck.id === selectedDeckId),
    [dashboard, selectedDeckId],
  );

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Flashcard MVP</p>
          <h1>Study what matters, right when it is due.</h1>
          <p>
            Create local decks, add cards, and review them with a lightweight spaced-repetition schedule.
          </p>
        </div>
        {selectedDeckId && (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSelectedDeckId(null);
              setIsStudying(false);
              refreshDashboard();
            }}
          >
            Back to decks
          </button>
        )}
      </header>

      {error && <p className="notice error">{error}</p>}
      {isLoading && <p className="notice">Loading your flashcards...</p>}

      {!isLoading && !selectedDeckId && (
        <>
          <AboutPanel />
          <DeckDashboard decks={dashboard} onRefresh={refreshDashboard} onOpenDeck={setSelectedDeckId} />
        </>
      )}
      {!isLoading && selectedDeckId && !isStudying && (
        <DeckDetail
          deck={selectedDeck}
          deckId={selectedDeckId}
          onDeleted={() => {
            setSelectedDeckId(null);
            refreshDashboard();
          }}
          onRefresh={refreshDashboard}
          onStudy={() => setIsStudying(true)}
        />
      )}
      {!isLoading && selectedDeckId && isStudying && (
        <StudySession deck={selectedDeck} deckId={selectedDeckId} onExit={() => setIsStudying(false)} onRefresh={refreshDashboard} />
      )}
    </main>
  );
}

function AboutPanel() {
  return (
    <section className="about-panel">
      <div className="about-intro">
        <p className="eyebrow">How it works</p>
        <h2>Your personal flashcard study portal</h2>
        <p>
          This app helps you learn with simple decks, front-and-back cards, and a review schedule that brings cards
          back when they are due.
        </p>
      </div>

      <div className="about-grid">
        <article>
          <h3>Start with decks</h3>
          <p>
            A deck is a collection of cards for one topic. You can use the included starter decks, such as the TELC
            German vocabulary lessons, or create your own.
          </p>
        </article>
        <article>
          <h3>Study one card at a time</h3>
          <p>
            Read the front, reveal the answer, then rate how well you knew it. The app uses that rating to decide when
            the card should appear again.
          </p>
        </article>
        <article>
          <h3>Your data stays local</h3>
          <p>
            Decks, cards, and progress are saved in this browser with IndexedDB. Nothing is sent to a server, and the
            seed decks are only added when the database is empty.
          </p>
        </article>
      </div>

      <div className="steps-list" aria-label="Quick start">
        <span>1. Pick or create a deck</span>
        <span>2. Add cards if needed</span>
        <span>3. Review due cards daily</span>
      </div>
    </section>
  );
}

function DeckDashboard({ decks, onOpenDeck, onRefresh }) {
  const [form, setForm] = useState(EMPTY_DECK_FORM);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    setIsSaving(true);
    await createDeck(form);
    setForm(EMPTY_DECK_FORM);
    setIsSaving(false);
    onRefresh();
  }

  return (
    <section className="layout-grid">
      <form className="panel stack" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">New deck</p>
          <h2>Create a deck</h2>
        </div>
        <label>
          Deck name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Japanese basics" />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Vocabulary, grammar, and phrases"
          />
        </label>
        <button type="submit" disabled={isSaving || !form.name.trim()}>
          {isSaving ? "Creating..." : "Create deck"}
        </button>
      </form>

      <section className="deck-list">
        {decks.length === 0 ? (
          <EmptyState title="No decks yet" body="Create your first deck, add a few cards, and your due queue will appear here." />
        ) : (
          decks.map((deck) => (
            <article className="deck-card" key={deck.id}>
              <div>
                <h2>{deck.name}</h2>
                <p>{deck.description || "No description yet."}</p>
              </div>
              <div className="stats-row">
                <Stat label="Due" value={deck.dueCards} />
                <Stat label="Cards" value={deck.totalCards} />
                <Stat label="Today" value={deck.reviewedToday} />
              </div>
              <button type="button" onClick={() => onOpenDeck(deck.id)}>
                Open deck
              </button>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

function DeckDetail({ deck, deckId, onDeleted, onRefresh, onStudy }) {
  const [cards, setCards] = useState([]);
  const [deckForm, setDeckForm] = useState(EMPTY_DECK_FORM);
  const [cardForm, setCardForm] = useState(EMPTY_CARD_FORM);
  const [editingCardId, setEditingCardId] = useState(null);

  async function refreshCards() {
    const [currentDeck, currentCards] = await Promise.all([getDeck(deckId), getCardsForDeck(deckId)]);
    setDeckForm({
      name: currentDeck?.name ?? "",
      description: currentDeck?.description ?? "",
    });
    setCards(currentCards);
  }

  useEffect(() => {
    refreshCards();
  }, [deckId]);

  async function handleDeckSubmit(event) {
    event.preventDefault();

    if (!deckForm.name.trim()) {
      return;
    }

    await updateDeck(deckId, deckForm);
    onRefresh();
    refreshCards();
  }

  async function handleCardSubmit(event) {
    event.preventDefault();

    if (!cardForm.front.trim() || !cardForm.back.trim()) {
      return;
    }

    if (editingCardId) {
      await updateCard(editingCardId, cardForm);
    } else {
      await createCard({ deckId, ...cardForm });
    }

    setCardForm(EMPTY_CARD_FORM);
    setEditingCardId(null);
    await refreshCards();
    onRefresh();
  }

  function startEditingCard(card) {
    setEditingCardId(card.id);
    setCardForm({ front: card.front, back: card.back });
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Deck detail</p>
          <h2>{deck?.name ?? deckForm.name}</h2>
        </div>
        <button type="button" onClick={onStudy} disabled={!deck?.dueCards}>
          Study due cards ({deck?.dueCards ?? 0})
        </button>
      </div>

      <section className="layout-grid">
        <form className="panel stack" onSubmit={handleDeckSubmit}>
          <h3>Deck settings</h3>
          <label>
            Deck name
            <input value={deckForm.name} onChange={(event) => setDeckForm({ ...deckForm, name: event.target.value })} />
          </label>
          <label>
            Description
            <textarea value={deckForm.description} onChange={(event) => setDeckForm({ ...deckForm, description: event.target.value })} />
          </label>
          <div className="actions">
            <button type="submit" disabled={!deckForm.name.trim()}>
              Save deck
            </button>
            <button
              className="danger"
              type="button"
              onClick={async () => {
                if (confirm("Delete this deck and all of its cards?")) {
                  await deleteDeck(deckId);
                  onDeleted();
                }
              }}
            >
              Delete deck
            </button>
          </div>
        </form>

        <form className="panel stack" onSubmit={handleCardSubmit}>
          <h3>{editingCardId ? "Edit card" : "Add card"}</h3>
          <label>
            Front
            <textarea value={cardForm.front} onChange={(event) => setCardForm({ ...cardForm, front: event.target.value })} />
          </label>
          <label>
            Back
            <textarea value={cardForm.back} onChange={(event) => setCardForm({ ...cardForm, back: event.target.value })} />
          </label>
          <div className="actions">
            <button type="submit" disabled={!cardForm.front.trim() || !cardForm.back.trim()}>
              {editingCardId ? "Save card" : "Add card"}
            </button>
            {editingCardId && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setEditingCardId(null);
                  setCardForm(EMPTY_CARD_FORM);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel stack">
        <h3>Cards</h3>
        {cards.length === 0 ? (
          <EmptyState title="No cards yet" body="Add at least one front and back pair to begin studying." />
        ) : (
          <div className="card-table">
            {cards.map((card) => (
              <article className="card-row" key={card.id}>
                <div>
                  <strong>{card.front}</strong>
                  <p>{card.back}</p>
                </div>
                <div className="actions">
                  <button className="secondary" type="button" onClick={() => startEditingCard(card)}>
                    Edit
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={async () => {
                      await deleteCard(card.id);
                      await refreshCards();
                      onRefresh();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function StudySession({ deck, deckId, onExit, onRefresh }) {
  const [dueCards, setDueCards] = useState([]);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshDueCards() {
    setIsLoading(true);
    setDueCards(await getDueCards(deckId));
    setIsAnswerVisible(false);
    setIsLoading(false);
  }

  useEffect(() => {
    refreshDueCards();
  }, [deckId]);

  const currentItem = dueCards[0];

  async function handleRating(rating) {
    await reviewCard(currentItem.card.id, rating);
    await refreshDueCards();
    onRefresh();
  }

  if (isLoading) {
    return <p className="notice">Preparing your study session...</p>;
  }

  if (!currentItem) {
    return (
      <section className="panel center stack">
        <EmptyState title="All caught up" body={`No due cards remain in ${deck?.name ?? "this deck"}.`} />
        <button type="button" onClick={onExit}>
          Return to deck
        </button>
      </section>
    );
  }

  return (
    <section className="study-panel stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Study session</p>
          <h2>{deck?.name}</h2>
        </div>
        <button className="secondary" type="button" onClick={onExit}>
          End session
        </button>
      </div>

      <article className="flashcard">
        <p className="eyebrow">Front</p>
        <h3>{currentItem.card.front}</h3>
        {isAnswerVisible ? (
          <div className="answer">
            <p className="eyebrow">Back</p>
            <p>{currentItem.card.back}</p>
          </div>
        ) : (
          <button type="button" onClick={() => setIsAnswerVisible(true)}>
            Reveal answer
          </button>
        )}
      </article>

      {isAnswerVisible && (
        <div className="rating-grid" aria-label="Review rating">
          {Object.values(RATINGS).map((rating) => (
            <button className={`rating ${rating}`} key={rating} type="button" onClick={() => handleRating(rating)}>
              {RATING_LABELS[rating]}
            </button>
          ))}
        </div>
      )}

      <p className="notice">{dueCards.length} due card{dueCards.length === 1 ? "" : "s"} in this session.</p>
    </section>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <span className="stat">
      <strong>{value}</strong>
      {label}
    </span>
  );
}
