import { useCallback, useEffect, useRef, useState } from "react";

type MeterSource = MediaStream | null;

export type AudioVolumeMeter = {
  volume: number;
  attach: (stream: MeterSource) => Promise<void>;
  detach: () => void;
};

/**
 * Small Web Audio meter that returns a smoothed 0..1 RMS value.
 * AudioContext creation is deferred until a user gesture starts the voice session.
 */
export function useAudioVolume(): AudioVolumeMeter {
  const [volume, setVolume] = useState(0);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const smoothedRef = useRef(0);

  const detach = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    silentGainRef.current = null;
    smoothedRef.current = 0;
    setVolume(0);

    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const attach = useCallback(async (stream: MeterSource) => {
    detach();
    if (!stream || stream.getAudioTracks().length === 0) return;

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    const silentGain = context.createGain();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    silentGain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(silentGain);
    silentGain.connect(context.destination);

    contextRef.current = context;
    sourceRef.current = source;
    analyserRef.current = analyser;
    silentGainRef.current = silentGain;
    if (context.state === "suspended") await context.resume();

    const samples = new Float32Array(analyser.fftSize);
    const measure = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      const normalized = Math.min(1, rms * 5.8);
      smoothedRef.current = smoothedRef.current * 0.72 + normalized * 0.28;
      setVolume(smoothedRef.current);
      frameRef.current = requestAnimationFrame(measure);
    };
    measure();
  }, [detach]);

  useEffect(() => detach, [detach]);

  return { volume, attach, detach };
}
