"use client";

import { useEffect, useRef, useState } from "react";

const MAX_RECORDING_MS = 30_000;
const MIN_RECORDING_MS = 500;
const SILENCE = "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA";

export function useVoice() {
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      const rec = recorder.current;
      if (rec) {
        rec.onstop = null;
        if (rec.state !== "inactive") rec.stop();
        rec.stream.getTracks().forEach((t) => t.stop());
      }
      player.current?.pause();
    },
    [],
  );

  function audio() {
    if (!player.current) {
      const a = new Audio();
      a.onended = () => setPlaying(null);
      a.onerror = () => {
        setPlaying(null);
        if (a.src.includes("/chat/speak")) setPlayError("Couldn't play that reply. Tap Listen to try again.");
      };
      player.current = a;
    }
    return player.current;
  }

  function stopPlaying() {
    player.current?.pause();
    setPlaying(null);
    setPlayError(null);
  }

  function play(messageId: string) {
    const a = audio();
    a.src = `/chat/speak?id=${encodeURIComponent(messageId)}`;
    setPlaying(messageId);
    setPlayError(null);
    a.play().catch(() => setPlaying(null));
  }

  async function record(onAudio: (audio: Blob | null) => void): Promise<string | null> {
    stopPlaying();
    const a = audio();
    a.src = SILENCE;
    a.play().catch(() => {});

    let rec: MediaRecorder;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        rec = new MediaRecorder(stream, { audioBitsPerSecond: 32_000 });
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        return "This browser can't record audio. Type your question instead.";
      }
    } catch (err) {
      return err instanceof DOMException && err.name === "NotAllowedError"
        ? "The microphone is blocked. Allow it in your browser settings, or type instead."
        : "No microphone found. Type your question instead.";
    }

    const chunks: Blob[] = [];
    const started = Date.now();
    const timer = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORDING_MS);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      clearTimeout(timer);
      rec.stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setRecording(false);
      onAudio(Date.now() - started >= MIN_RECORDING_MS && chunks.length ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null);
    };
    rec.start();
    recorder.current = rec;
    setRecording(true);
    return null;
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return { recording, playing, playError, record, stop, play, stopPlaying };
}
