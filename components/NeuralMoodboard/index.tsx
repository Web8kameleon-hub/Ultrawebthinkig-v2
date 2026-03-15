import React, { useState } from "react";
import styles from "./styles.module.css";
import { generateMoodboard } from "./api";

export default function NeuralMoodboard() {
  const [text, setText] = useState("");
  const [mood, setMood] = useState("neutral");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const moods = ["happy", "sad", "focus", "calm", "dreamy", "energetic", "neutral"];

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setAudioUrl(null);

    try {
      const data = await generateMoodboard(text, mood, file);
      setResult(data.moodboard);

      // audio path is returned by backend → fetch the file
      if (data.moodboard.sound_file) {
        const audioBlob = await fetch(data.moodboard.sound_file).then((res) => res.blob());
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      }
    } catch (err) {
      console.error(err);
      alert("Error generating moodboard");
    }

    setLoading(false);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>🎨✨ Neural Moodboard</h2>
      <p className={styles.subtitle}>
        Gjenero një moodboard unik bazuar në tekst, mood, foto ose audio.
      </p>

      <textarea
        placeholder="Shkruaj diçka (opsionale)..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={styles.textarea}
      />

      <label className={styles.label}>Mood:</label>
      <select
        value={mood}
        onChange={(e) => setMood(e.target.value)}
        className={styles.select}
      >
        {moods.map((m) => (
          <option key={m} value={m}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </option>
        ))}
      </select>

      <input
        type="file"
        accept="image/*,audio/*"
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        className={styles.input}
      />

      <button onClick={handleGenerate} className={styles.button} disabled={loading}>
        {loading ? "Duke gjeneruar..." : "Gjenero Moodboard"}
      </button>

      {result && (
        <div className={styles.resultBox}>
          <h3 className={styles.sectionTitle}>🎛️ Rezultati</h3>

          <div className={styles.row}>
            <span className={styles.label}>Mood:</span>
            <span className={styles.value}>{result.mood}</span>
          </div>

          {result.color_dominant && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Ngjyra Dominante:</span>
                <span className={styles.value}>
                  rgb({result.color_dominant.join(", ")})
                </span>
              </div>

              <div className={styles.colors}>
                {result.palette.map((c: number[], idx: number) => (
                  <div
                    key={idx}
                    className={styles.colorBox}
                    style={{
                      backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})`,
                    }}
                  />
                ))}
              </div>
            </>
          )}

          <div className={styles.quoteBox}>
            <span className={styles.quote}>{result.quote}</span>
          </div>

          {audioUrl && (
            <div className={styles.audioBox}>
              <h4 className={styles.sectionSubtitle}>🎧 Mini Soundscape</h4>
              <audio controls src={audioUrl} className={styles.audioPlayer} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
