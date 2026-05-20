import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flame,
  Gauge,
  Medal,
  RotateCcw,
  ShieldAlert,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react';
import cards from './data/cards.json';
import './styles.css';

const ROUND_SECONDS = 120;
const HIGHSCORE_KEY = 'lagesprint-highscores';

const sourceMaterials = [
  'Aufgaben-und-Funktionen-der-KgS.pdf',
  'Fuehren mit Stab.pdf',
  'Hilfsmittel_S1-S6_Tischvorlage-Sachgebiete.pdf',
  'Stabsbesprechung - Leitfaden und Checkliste.pdf',
  'Zusammenfassung der Katastrophenschutzkonzepte NRW.pdf',
];

const missionNames = [
  'Bereitstellungsraum sortieren',
  'Lagekarte entwirren',
  'Stabsbesprechung retten',
  'Meldekopf wachkitzeln',
  'S1 bis S6 synchronisieren',
  'Entschluss sauber landen',
];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function readHighscores() {
  try {
    return JSON.parse(localStorage.getItem(HIGHSCORE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function buildRound() {
  return shuffle(cards).map((card) => ({
    ...card,
    answers: shuffle(card.answers),
  }));
}

function App() {
  const [mode, setMode] = useState('briefing');
  const [roundCards, setRoundCards] = useState(() => buildRound());
  const [cardIndex, setCardIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctCards, setCorrectCards] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [lastDelta, setLastDelta] = useState(null);
  const [highscores, setHighscores] = useState(() => readHighscores());
  const [playerName, setPlayerName] = useState('Stab 1');
  const [reviewLog, setReviewLog] = useState([]);

  const currentCard = roundCards[cardIndex];
  const progress = Math.round((answered / cards.length) * 100);
  const roundActive = mode === 'playing' && !revealed;

  useEffect(() => {
    if (mode !== 'playing' || secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          finishRound('Zeit abgelaufen');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, secondsLeft]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const roundTitle = useMemo(
    () => missionNames[cardIndex % missionNames.length],
    [cardIndex],
  );

  function startRound() {
    setRoundCards(buildRound());
    setCardIndex(0);
    setSelected([]);
    setRevealed(false);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAnswered(0);
    setCorrectCards(0);
    setSecondsLeft(ROUND_SECONDS);
    setLastDelta(null);
    setReviewLog([]);
    setMode('playing');
  }

  function toggleAnswer(answerId) {
    if (revealed || mode !== 'playing') return;
    setSelected((items) =>
      items.includes(answerId)
        ? items.filter((item) => item !== answerId)
        : [...items, answerId],
    );
  }

  function evaluateCard() {
    if (!currentCard || selected.length === 0 || revealed) return;
    const correctIds = currentCard.answers
      .filter((answer) => answer.correct)
      .map((answer) => answer.id)
      .sort();
    const selectedIds = [...selected].sort();
    const exact = correctIds.length === selectedIds.length && correctIds.every((id, index) => id === selectedIds[index]);
    const partialHits = selectedIds.filter((id) => correctIds.includes(id)).length;
    const falseAlarms = selectedIds.length - partialHits;
    const base = exact ? 120 : Math.max(0, partialHits * 35 - falseAlarms * 25);
    const speedBonus = exact ? Math.min(35, Math.floor(secondsLeft / 4)) : 0;
    const comboBonus = exact ? Math.min(80, streak * 10) : 0;
    const delta = base + speedBonus + comboBonus;
    const nextStreak = exact ? streak + 1 : 0;

    setScore((value) => value + delta);
    setStreak(nextStreak);
    setBestStreak((value) => Math.max(value, nextStreak));
    setAnswered((value) => value + 1);
    setCorrectCards((value) => value + (exact ? 1 : 0));
    setLastDelta({ exact, delta, partialHits, falseAlarms, correctIds });
    setReviewLog((items) => [
      {
        id: currentCard.id,
        question: currentCard.question,
        exact,
        selected: selectedIds.length,
        correct: correctIds.length,
      },
      ...items,
    ].slice(0, 8));
    setRevealed(true);
  }

  function nextCard() {
    if (answered >= cards.length || cardIndex >= roundCards.length - 1) {
      finishRound('Runde beendet');
      return;
    }
    setCardIndex((value) => value + 1);
    setSelected([]);
    setRevealed(false);
    setLastDelta(null);
  }

  function finishRound(reason) {
    setMode('finished');
    const entry = {
      id: crypto.randomUUID(),
      name: playerName.trim() || 'Stab 1',
      score,
      correctCards,
      answered,
      bestStreak,
      reason,
      date: new Date().toLocaleDateString('de-DE'),
    };
    setHighscores((items) => {
      const next = [entry, ...items].sort((a, b) => b.score - a.score).slice(0, 8);
      localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const accuracy = answered ? Math.round((correctCards / answered) * 100) : 0;

  return (
    <main className="app-shell">
      <section className="command-room" aria-label="LageSprint Lernspiel">
        <div className="ambient-grid" />
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark"><ShieldAlert size={24} /></div>
            <div>
              <p>LageSprint</p>
              <h1>Karteikarten Einsatzrunde</h1>
            </div>
          </div>
          <div className="round-controls">
            <label>
              Rufname
              <input
                value={playerName}
                maxLength={16}
                onChange={(event) => setPlayerName(event.target.value)}
                disabled={mode === 'playing'}
              />
            </label>
            <button className="ghost-button" type="button" onClick={startRound}>
              <RotateCcw size={17} />
              Neue Runde
            </button>
          </div>
        </header>

        <div className="game-layout">
          <aside className="left-rail" aria-label="Rundenstatus">
            <Metric icon={<Timer />} label="Zeit" value={formatTime(secondsLeft)} tone={secondsLeft < 20 ? 'danger' : 'normal'} />
            <Metric icon={<Gauge />} label="Lagepunkte" value={score} tone="accent" />
            <Metric icon={<Flame />} label="Serie" value={`${streak}x`} tone={streak >= 3 ? 'hot' : 'normal'} />
            <div className="progress-panel">
              <div className="panel-title">
                <ClipboardList size={18} />
                Fortschritt
              </div>
              <div className="progress-ring" style={{ '--progress': `${progress}%` }}>
                <span>{progress}%</span>
              </div>
              <p>{answered} von {cards.length} Karten bearbeitet</p>
            </div>
            <div className="materials">
              <div className="panel-title">
                <BookOpen size={18} />
                Material
              </div>
              {sourceMaterials.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </aside>

          <section className="playfield">
            {mode === 'briefing' && (
              <div className="briefing-card">
                <p className="mission-label">Einsatzauftrag</p>
                <h2>Finde alle richtigen Aussagen, bevor die Lage kippt.</h2>
                <p>
                  Jede Karte kann mehrere korrekte Antworten haben. Exakte Treffer bringen Tempo- und Serienbonus,
                  falsche Alarme kosten Punkte. Witzig genug fuer Motivation, ernst genug fuer die Stabsbesprechung.
                </p>
                <button className="primary-button" type="button" onClick={startRound}>
                  Einsatzrunde starten
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            {mode === 'playing' && currentCard && (
              <article className={`question-card ${revealed ? 'is-revealed' : ''}`}>
                <div className="question-header">
                  <div>
                    <p className="mission-label">Karte {cardIndex + 1} / {cards.length}</p>
                    <h2>{roundTitle}</h2>
                  </div>
                </div>
                <p className="question-text">{currentCard.question}</p>
                {currentCard.media.length > 0 && (
                  <div className="question-media">
                    {currentCard.media.map((item) => (
                      <img
                        key={item.src}
                        src={`/cards-media/${encodeURIComponent(item.src)}`}
                        alt={item.alt}
                      />
                    ))}
                  </div>
                )}
                <div className="answers">
                  {currentCard.answers.map((answer, index) => {
                    const active = selectedSet.has(answer.id);
                    const showCorrect = revealed && answer.correct;
                    const showWrong = revealed && active && !answer.correct;
                    return (
                      <button
                        key={answer.id}
                        type="button"
                        className={`answer-button ${active ? 'is-selected' : ''} ${showCorrect ? 'is-correct' : ''} ${showWrong ? 'is-wrong' : ''}`}
                        onClick={() => toggleAnswer(answer.id)}
                        disabled={revealed}
                      >
                        <span>{String.fromCharCode(65 + index)}</span>
                        {answer.text}
                      </button>
                    );
                  })}
                </div>
                <div className="action-row">
                  {!revealed ? (
                    <button className="primary-button" type="button" onClick={evaluateCard} disabled={selected.length === 0 || !roundActive}>
                      Auswerten
                      <CheckCircle2 size={19} />
                    </button>
                  ) : (
                    <button className="primary-button" type="button" onClick={nextCard}>
                      Nächste Karte
                      <ChevronRight size={19} />
                    </button>
                  )}
                  <div className={`verdict ${lastDelta?.exact ? 'good' : 'mixed'}`}>
                    {lastDelta ? (
                      <>
                        {lastDelta.exact ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        {lastDelta.exact ? 'Saubere Lage!' : 'Nachschärfen.'} +{lastDelta.delta}
                      </>
                    ) : (
                      'Mehrfachauswahl moeglich'
                    )}
                  </div>
                </div>
              </article>
            )}

            {mode === 'finished' && (
              <div className="briefing-card finished">
                <p className="mission-label">Nachbesprechung</p>
                <h2>{accuracy}% Trefferquote, {score} Lagepunkte.</h2>
                <p>
                  {correctCards} von {answered} Karten exakt geloest. Beste Serie: {bestStreak}.
                  {accuracy >= 80 ? ' Der Stab nickt anerkennend.' : ' Der Stab bleibt ruhig, aber der Flipchart quietscht.'}
                </p>
                <button className="primary-button" type="button" onClick={startRound}>
                  Revanche starten
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </section>

          <aside className="scoreboard" aria-label="Highscore und Auswertung">
            <div className="score-head">
              <div>
                <p>Highscore</p>
                <h2>Stabsrangliste</h2>
              </div>
              <Trophy size={27} />
            </div>
            <ol className="score-list">
              {highscores.length === 0 && <li className="empty-score">Noch keine Runde. Die Tafel ist unheimlich sauber.</li>}
              {highscores.map((entry, index) => (
                <li key={entry.id}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <strong>{entry.name}</strong>
                    <small>{entry.correctCards}/{entry.answered} korrekt · Serie {entry.bestStreak}</small>
                  </div>
                  <b>{entry.score}</b>
                </li>
              ))}
            </ol>
            <div className="review">
              <div className="panel-title">
                <Award size={18} />
                Letzte Entscheidungen
              </div>
              {reviewLog.length === 0 ? (
                <p className="empty-review">Hier landet gleich die Nachbesprechung.</p>
              ) : (
                reviewLog.map((item) => (
                  <div className="review-item" key={item.id}>
                    {item.exact ? <Medal size={17} /> : <ShieldAlert size={17} />}
                    <span>{item.question}</span>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value, tone }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{React.cloneElement(icon, { size: 20 })}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
