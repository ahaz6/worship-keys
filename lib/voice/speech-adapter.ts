/**
 * Speech recognition adapter (spec 16.3, 17.9).
 *
 * Written as a provider seam on purpose. The Web Speech API is the MVP
 * provider; on some browsers it sends audio to a remote service, which the UI
 * has to say before the microphone is ever opened. A local or server-side ASR
 * can be dropped in behind the same interface later without touching the UI.
 */

export type TranscriptSegment = {
  id: string;
  text: string;
  /** Interim results are shown greyed out and never trigger a command. */
  final: boolean;
  confidence: number;
  at: number;
};

export type SpeechAdapterEvents = {
  onSegment: (segment: TranscriptSegment) => void;
  onStateChange: (state: SpeechAdapterState) => void;
  onError: (message: string) => void;
};

export type SpeechAdapterState = "unsupported" | "idle" | "listening" | "error";

export interface SpeechAdapter {
  readonly id: string;
  readonly usesRemoteService: boolean;
  isSupported(): boolean;
  start(options: { language: string; track?: MediaStreamTrack | null }): Promise<void>;
  stop(): void;
  setEvents(events: SpeechAdapterEvents): void;
}

type RecognitionResultLike = {
  isFinal: boolean;
  length: number;
  0: { transcript: string; confidence: number };
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: ((track?: MediaStreamTrack) => void) | (() => void);
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export class WebSpeechAdapter implements SpeechAdapter {
  readonly id = "web-speech";
  /** Chrome routes recognition through a Google service, so this is true. */
  readonly usesRemoteService = true;

  private recognition: RecognitionLike | null = null;
  private events: SpeechAdapterEvents | null = null;
  private wantsToListen = false;
  private counter = 0;
  /** Set when the recogniser is actually reading a chosen device's track. */
  private usingSelectedTrack = false;

  setEvents(events: SpeechAdapterEvents): void {
    this.events = events;
  }

  isSupported(): boolean {
    return recognitionConstructor() != null;
  }

  /** True when transcription really uses the selected device rather than the system mic. */
  get readsSelectedTrack(): boolean {
    return this.usingSelectedTrack;
  }

  async start({ language, track }: { language: string; track?: MediaStreamTrack | null }): Promise<void> {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      this.events?.onStateChange("unsupported");
      return;
    }

    this.stop();
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const alternative = result[0];
        this.counter += 1;
        this.events?.onSegment({
          id: `segment-${this.counter}`,
          text: alternative.transcript.trim(),
          final: result.isFinal,
          confidence: alternative.confidence || (result.isFinal ? 0.6 : 0.3),
          at: Date.now(),
        });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.events?.onError(
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow it in your browser settings."
          : `Speech recognition stopped: ${event.error}`,
      );
      this.events?.onStateChange("error");
    };

    recognition.onend = () => {
      // Chrome ends the session on its own schedule; restart while the user
      // still wants to listen, and go quiet the moment they do not.
      if (this.wantsToListen) {
        try {
          (recognition.start as () => void)();
          return;
        } catch {
          this.events?.onError("Speech recognition could not restart.");
        }
      }
      this.events?.onStateChange("idle");
    };

    this.recognition = recognition;
    this.wantsToListen = true;

    // The newer start(audioTrack) form reads a specific device. Where it is not
    // available the browser falls back to the system input, and the UI says so
    // rather than pretending the chosen SQ channel is being used.
    try {
      if (track && recognition.start.length > 0) {
        (recognition.start as (input: MediaStreamTrack) => void)(track);
        this.usingSelectedTrack = true;
      } else {
        (recognition.start as () => void)();
        this.usingSelectedTrack = false;
      }
      this.events?.onStateChange("listening");
    } catch (error) {
      this.wantsToListen = false;
      this.events?.onError(error instanceof Error ? error.message : "Speech recognition could not start.");
      this.events?.onStateChange("error");
    }
  }

  stop(): void {
    this.wantsToListen = false;
    this.usingSelectedTrack = false;
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch {
      // Already stopped.
    }
    this.recognition.onresult = null;
    this.recognition.onerror = null;
    this.recognition.onend = null;
    this.recognition = null;
  }
}

export const REMOTE_RECOGNITION_NOTICE =
  "Your browser may send microphone audio to a speech service to transcribe it. Nothing is stored by Worship Keys, and transcripts are cleared when the session ends.";
