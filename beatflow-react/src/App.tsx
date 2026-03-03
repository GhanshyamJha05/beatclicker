import React, { useState } from "react";
import { Game } from "./components/Game";

const LEVELS = ["easy", "normal", "hard"] as const;
type Level = (typeof LEVELS)[number];

const SONGS = [
  { id: "chill", label: "Chill Pad" },
  { id: "groove", label: "Soft Groove" },
  { id: "spark", label: "Bright Pop" },
] as const;
type SongId = (typeof SONGS)[number]["id"];

const App: React.FC = () => {
  const [level, setLevel] = useState<Level>("easy");
  const [songId, setSongId] = useState<SongId>("chill");
  const [gameKey, setGameKey] = useState(0);

  return (
    <div className="app-root">
      <div className="game-wrapper">
        <header className="top-bar">
          <div className="logo">BeatFlow</div>

          <div className="status-row">
            <div className="status-block">
              <span className="label">Level</span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
              >
                {LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="status-block">
              <span className="label">Song</span>
              <div className="song-select-options">
                {SONGS.map((s) => (
                  <button
                    key={s.id}
                    className={
                      "song-option" + (songId === s.id ? " active" : "")
                    }
                    onClick={() => setSongId(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="controls">
            <button onClick={() => setGameKey((k) => k + 1)}>Restart</button>
          </div>
        </header>

        <Game key={gameKey} level={level} songId={songId} />
      </div>
    </div>
  );
};

export default App;

