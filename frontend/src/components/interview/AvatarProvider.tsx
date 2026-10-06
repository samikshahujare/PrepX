"use client";

import React from "react";
import AvatarStage from "./AvatarStage";
import { InterviewState } from "@/types";

export interface AvatarProviderProps {
  sessionId?: string;
  state: InterviewState;
  interviewerText?: string;
  isSpeaking: boolean;
  audioLevel?: number;
  onEndInterview?: () => void;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
  candidateStream?: MediaStream | null;
  candidateName?: string;
  showCandidateInset?: boolean;
  durationMinutes?: number;
  onAvatarReady?: () => void;
  onSpeakingEnd?: () => void;
}

export default function AvatarProvider({
  sessionId,
  state,
  interviewerText,
  isSpeaking,
  audioLevel = 0,
  onEndInterview,
  onToggleMic,
  onToggleCamera,
  micEnabled = true,
  cameraEnabled = true,
  candidateStream = null,
  candidateName = "Candidate",
  showCandidateInset = true,
  durationMinutes = 30,
  onAvatarReady,
  onSpeakingEnd,
}: AvatarProviderProps) {
  return (
    <AvatarStage
      sessionId={sessionId}
      state={state}
      interviewerText={interviewerText}
      isSpeaking={isSpeaking}
      audioLevel={audioLevel}
      onEndInterview={onEndInterview}
      onToggleMic={onToggleMic}
      onToggleCamera={onToggleCamera}
      micEnabled={micEnabled}
      cameraEnabled={cameraEnabled}
      candidateStream={candidateStream}
      candidateName={candidateName}
      showCandidateInset={showCandidateInset}
      durationMinutes={durationMinutes}
      onAvatarReady={onAvatarReady}
      onSpeakingEnd={onSpeakingEnd}
    />
  );
}
