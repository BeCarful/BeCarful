"use client";

import { useEffect, useRef, useState } from "react";
import { silenceDetector } from "./vad";

const MAX_RECORDING_MS = 30_000;
const MIN_RECORDING_MS = 500;
const SILENCE = "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA";

export function useVoice() {
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const listening = useRef<(() => void) | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      listening.current?.();
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

  function play(messageId: string, assistantId: string) {
    const a = audio();
    a.src = `/chat/speak?id=${encodeURIComponent(messageId)}&v=${encodeURIComponent(assistantId)}`;
    setPlaying(messageId);
    setPlayError(null);
    a.play().catch(() => setPlaying(null));
  }

  async function record(onAudio: (audio: Blob | null) => void): Promise<string | null> {
    stopPlaying();
    const a = audio();
    a.src = SILENCE;
    a.play().catch(() => {});

    const ctx = typeof AudioContext === "undefined" ? null : new AudioContext();
    const closeCtx = () => ctx?.close().catch(() => {});
    let rec: MediaRecorder;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        rec = new MediaRecorder(stream, { audioBitsPerSecond: 32_000 });
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        closeCtx();
        return "This browser can't record audio. Type your question instead.";
      }
    } catch (err) {
      closeCtx();
      return err instanceof DOMException && err.name === "NotAllowedError"
        ? "The microphone is blocked. Allow it in your browser settings, or type instead."
        : "No microphone found. Type your question instead.";
    }

    const chunks: Blob[] = [];
    const started = Date.now();
    const timer = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORDING_MS);
    let poll: ReturnType<typeof setInterval> | undefined;
    if (ctx) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(rec.stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const shouldStop = silenceDetector();
      let alive = false;
      poll = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        const level = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
        alive ||= level > 0;
        if (alive && shouldStop(level, Date.now()) && rec.state === "recording") rec.stop();
      }, 50);
    }
    listening.current = () => {
      clearTimeout(timer);
      clearInterval(poll);
      closeCtx();
      listening.current = null;
    };
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      listening.current?.();
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
