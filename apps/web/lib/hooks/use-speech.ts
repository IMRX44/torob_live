"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Persian voice input via the Web Speech API, where the browser supports it. */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "fa-IR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]![0]!.transcript;
        final = e.results[i]!.isFinal;
      }
      cb.current(text, final);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setSupported(true);
  }, []);

  const toggle = useCallback(() => {
    if (!rec.current) return;
    if (listening) {
      rec.current.stop();
      setListening(false);
    } else {
      try {
        rec.current.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }, [listening]);

  return { supported, listening, toggle };
}
