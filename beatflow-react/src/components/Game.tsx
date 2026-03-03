import React, { useEffect } from "react";
import { useRhythmGame } from "../hooks/useRhythmGame";

type GameProps = {
  level: "easy" | "normal" | "hard";
  songId: "chill" | "groove" | "spark";
};

export const Game: React.FC<GameProps> = ({ level, songId }) => {
  const {
    score,
    combo,
    accuracy,
    judgement,
    lanes,
    notes,
    handleKeyDown,
    start,
    pauseOrResume,
    isRunning,
  } = useRhythmGame({ level, songId });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKeyDown]);

  return (
    <main className="playfield-container">
      <div className="hud-row">
        <div className="hud-metric">
          <span className="label">Score</span>
          <span className="value">{score}</span>
        </div>
        <div className="hud-metric">
          <span className="label">Combo</span>
          <span className="value">{combo}</span>
        </div>
        <div className="hud-metric">
          <span className="label">Acc</span>
          <span className="value">{accuracy.toFixed(1)}%</span>
        </div>
        <div className="hud-controls">
          <button onClick={start}>{isRunning ? "Restart" : "Start"}</button>
          <button onClick={pauseOrResume}>
            {isRunning ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      <div className="lanes-label">Use A S D &nbsp;&nbsp;&nbsp; J K L</div>

      <div className="playfield">
        {lanes.map((lane) => {
          const laneNotes = notes.filter((n) => n.laneIndex === lane.index);
          return (
            <div key={lane.id} className="lane">
              <div className="lane-key">{lane.key}</div>
              <div className="hit-line" />
              {laneNotes.map((note) => (
                <div
                  key={note.id}
                  className={
                    "note" +
                    (note.miss ? " miss" : "") +
                    (note.hit ? " hit" : "")
                  }
                  style={{
                    top: `${note.yPercent}%`,
                    // @ts-ignore CSS custom property
                    "--noteColor": note.color,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="judgement">{judgement}</div>

      <section className="info-panel">
        <div className="instructions">
          <h2>How to Play</h2>
          <ul>
            <li>
              Press <strong>A S D</strong> with your left hand and{" "}
              <strong>J K L</strong> with your right.
            </li>
            <li>Hit the notes when they cross the glowing line.</li>
            <li>Good timing gives Perfect / Great / Good / Miss.</li>
            <li>Build combo for higher scores and accuracy.</li>
          </ul>
        </div>
      </section>
    </main>
  );
};

