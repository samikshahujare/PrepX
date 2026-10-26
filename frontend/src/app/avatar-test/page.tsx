"use client";

import React from "react";
import AvatarStage from "@/components/interview/AvatarStage";
import { notFound } from "next/navigation";

export default function DevAvatarTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#0b0f17", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "12px 24px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ color: "#f8fafc", fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
          PrepX — Sarah Jenkins Lip-Sync & Facial Animation Test Suite
        </h1>
        <span style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#0284c7", color: "#fff", fontWeight: 700 }}>
          DEV ONLY
        </span>
      </header>
      <div style={{ flex: 1, position: "relative" }}>
        <AvatarStage
          sessionId="dev-test-session"
          state="idle"
          interviewerText="Hello! I am Sarah Jenkins. Testing facial articulation and lip sync."
          isSpeaking={false}
          candidateName="Test Engineer"
          micEnabled={true}
          durationMinutes={15}
        />
      </div>
    </div>
  );
}
