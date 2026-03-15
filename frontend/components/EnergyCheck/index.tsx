import React, { useState, useRef } from "react";
import styles from "./styles.module.css";
import { runEnergyCheck } from "./api";

export default function EnergyCheck() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorder.current.ondataavailable = (e) => {
      chunks.current.push(e.data);
    };
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      setAudioBlob(blob);
    };
    mediaRecorder.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  const handleAnalyze = async () => {
    if (!audioBlob) {
      alert("Nuk ke regjistruar audio!");
      return;
    }
    setLoading(true);
    try {
      const data = await runEnergyCheck(audioBlob);
      setResult(data.energy);
    } catch (err) {
      console.error(err);
      alert("Error in Daily Energy Check");
    }
    setLoading(false);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>⚡ Daily Energy Check</h2>
      <p className={styles.subtitle}>
        Regjistro 3 sekonda zë dhe merr analizë energjie të personalizuar.
      </p>
      <div className={styles.controls}>
        {!recording ? (
          <button onClick={startRecording} className={styles.recordBtn}>
            🎤 Fillo Regjistrimin
          </button>
        ) : (
          <button onClick={stopRecording} className={styles.stopBtn}>
            ⏹️ Ndalo
          </button>
        )}
      </div>
      {audioBlob && (
        <audio
          controls
          src={URL.createObjectURL(audioBlob)}
          className={styles.audioPlayer}
        />
      )}
      <button
        onClick={handleAnalyze}
        disabled={!audioBlob || loading}
        className={styles.analyzeBtn}
      >
        {loading ? "Duke analizuar..." : "Analizo Energjinë"}
      </button>
      {result && (
        <div className={styles.resultBox}>
          <h3 className={styles.sectionTitle}>📊 Rezultati i Energjisë</h3>
          <div className={styles.row}>
            <span className={styles.label}>Dominant Freq:</span>
            <span className={styles.value}>
              {result.dominant_frequency.toFixed(2)} Hz
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Vocal Tension:</span>
            <span className={styles.value}>{result.vocal_tension.toFixed(2)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Brightness:</span>
            <span className={styles.value}>
              {result.brightness_centroid.toFixed(2)}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Energy Score:</span>
            <span className={styles.value}>{result.energy_score}/100</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Emotion:</span>
            <span className={styles.value}>{result.emotion}</span>
          </div>
        </div>
      )}
    </div>
  );
}
