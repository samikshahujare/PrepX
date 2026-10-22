export interface SpeechToTextCallbacks {
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (listening: boolean) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export interface ISpeechToTextProvider {
  isSupported(): boolean;
  startListening(callbacks: SpeechToTextCallbacks): void;
  stopListening(): void;
  isListening(): boolean;
}

export interface TextToSpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (charIndex: number) => void;
}

export interface ITextToSpeechProvider {
  isSupported(): boolean;
  speak(text: string, callbacks?: TextToSpeechCallbacks): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;
}
