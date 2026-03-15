import React, { useState } from "react";
import styles from "./styles.module.css";
import { generateBrainSync } from "./api";

export default function BrainSyncMusic() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState("relax");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const modes = [
    "relax",
    "focus",
    "sleep",
    "motivation",
    "creativity",
    "recovery",
  ];

  const handleGenerate = async () => {
    if (!file) return;

    setLoading(true);
    setAudioUrl(null);

    try {
      const blob = await generateBrainSync(file, mode);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      console.error(err);
      alert("Error generating BrainSync music");
    }

    setLoading(false);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>🧠✨ Brain-Sync Personal Music</h2>
      <p className={styles.subtitle}>
        Muzikë e personalizuar bazuar në personalitetin harmonik.
      </p>

      <div className={styles.row}>
        <label className={styles.label}>Zgjidh modalitetin:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className={styles.select}
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        className={styles.input}
      />

      <button
        onClick={handleGenerate}
        disabled={!file || loading}
        className={styles.button}
      >
        {loading ? "Duke gjeneruar..." : "Gjenero Muzikë Personalizuar"}
      </button>

      {audioUrl && (
        <div className={styles.playerBox}>
          <h3 className={styles.playerTitle}>🎧 Muzika Jote Brain-Sync</h3>
          <audio controls src={audioUrl} className={styles.audioPlayer} />
        </div>
      )}
    </div>
  );
}
