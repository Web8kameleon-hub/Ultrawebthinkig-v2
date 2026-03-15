import React, { useState } from "react";
import styles from "./styles.module.css";
import { fetchYouTubeInsight } from "./api";

export default function YouTubeInsight() {
  const [videoId, setVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const extractVideoId = (url: string): string => {
    try {
      if (url.includes("youtube.com/watch?v=")) {
        return url.split("v=")[1].split("&")[0];
      }
      if (url.includes("youtu.be/")) {
        return url.split("youtu.be/")[1].split("?")[0];
      }
      return url; // already ID
    } catch {
      return url;
    }
  };

  const handleAnalyze = async () => {
    if (!videoId) return;
    const id = extractVideoId(videoId);
    setLoading(true);
    setResult(null);
    try {
      const data = await fetchYouTubeInsight(id);
      setResult(data.insight);
    } catch (err) {
      console.error(err);
      alert("Error loading YouTube insights");
    }
    setLoading(false);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>📺 YouTube Insight Generator</h2>
      <p className={styles.subtitle}>
        Analizo inteligjentisht një video YouTube — emocion, trend, audience, temat kryesore.
      </p>
      <input
        type="text"
        placeholder="Vendos video ID ose YouTube URL..."
        value={videoId}
        onChange={(e) => setVideoId(e.target.value)}
        className={styles.input}
      />
      <button
        className={styles.button}
        onClick={handleAnalyze}
        disabled={loading || !videoId}
      >
        {loading ? "Duke analizuar..." : "Analizo Videon"}
      </button>
      {result && (
        <div className={styles.resultBox}>
          <h3 className={styles.sectionTitle}>📊 Rezultatet e Analizës</h3>
          <div className={styles.row}>
            <span className={styles.label}>Titulli:</span>
            <span className={styles.value}>{result.title}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Emotion:</span>
            <span className={`${styles.value} ${styles.emotion}`}>
              {result.emotion}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Engagement Score:</span>
            <span className={styles.value}>{result.engagement_score}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Trend Potential:</span>
            <span className={styles.value}>{result.trend}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Audience:</span>
            <span className={styles.value}>{result.target_audience}</span>
          </div>
          <div className={styles.topicsBox}>
            <h4 className={styles.smallTitle}>Temat Kryesore</h4>
            <div className={styles.topics}>
              {result.topics.map((t: string, i: number) => (
                <span key={i} className={styles.topic}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>BrainSync Mode:</span>
            <span className={styles.bsValue}>
              {result.recommended_brainsync_mode}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
