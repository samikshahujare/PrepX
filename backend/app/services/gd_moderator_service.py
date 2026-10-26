import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.gd import GDSession, GDTranscript
from app.services.llm_service import LLMProviderManager

logger = logging.getLogger("prepx.gd_moderator")


class GDModeratorService:
    def __init__(self, db: Session):
        self.db = db
        self.llm_manager = LLMProviderManager()
        # In-memory cooldown tracking per session
        self._last_intervention_epoch: Dict[str, float] = {}
        self._given_time_warnings: Dict[str, set] = {}

    def generate_opening(self, topic: str, duration_minutes: int) -> str:
        """Generate Sarah's welcome and rules introduction as the AI Host and Moderator."""
        prompt = (
            f"You are Sarah Jenkins, the AI Host and Moderator for a professional Group Discussion.\n"
            f"Topic: {topic}\n"
            f"Duration: {duration_minutes} minutes\n\n"
            "Generate a warm, authoritative opening statement (approx 55-75 words).\n"
            "Introduce yourself clearly as Sarah Jenkins, the AI host and moderator.\n"
            "Introduce the topic clearly, remind participants to present clear rationale, listen actively to each other, "
            "and invite all members to contribute constructively.\n"
            "Do not use markdown formatting. Return plain spoken speech."
        )

        try:
            res = self.llm_manager.generate(
                prompt=prompt,
                system_prompt="You are Sarah Jenkins, AI host and moderator. Speak naturally in plain text.",
                temperature=0.7,
                max_tokens=200,
            )
            if res.success and res.content:
                clean_text = res.content.strip().replace('"', "")
                if len(clean_text) >= 50 and ("sarah" in clean_text.lower() or "topic" in clean_text.lower() or topic.lower()[:15] in clean_text.lower()):
                    return clean_text
        except Exception as e:
            logger.warning(f"Error generating opening statement with LLM: {e}")

        # Deterministic professional fallback
        return (
            f"Welcome, everyone. I am Sarah Jenkins, your AI host and moderator for today's Group Discussion. "
            f"Our topic is: {topic}. We have {duration_minutes} minutes for this session. "
            "Please support your arguments with clear rationale and practical examples, listen actively to your peers, "
            "and ensure everyone has a chance to contribute. The floor is now open for anyone to initiate."
        )

    def generate_silence_prompt(
        self,
        topic: str,
        quieter_name: Optional[str] = None,
        recent_transcripts: Optional[List[GDTranscript]] = None,
    ) -> Dict[str, Any]:
        """Generate an encouraging prompt to break room silence, prioritizing quieter participants."""
        if quieter_name:
            text = f"{quieter_name}, we would love to hear your perspective on this. What thoughts or examples would you like to share with the group?"
        else:
            text = "Let's keep the discussion moving forward. Who would like to build on what has been shared so far, or introduce an alternative angle?"

        return {
            "type": "MODERATOR_SPEAK",
            "text": text,
            "gesture": "EXPLAINING_OPEN_PALMS",
            "expression": "WARM_SMILE",
            "reason": "silence_breaker_quiet_participant" if quieter_name else "silence_breaker_general",
        }

    def generate_balance_prompt(self, dominant_name: str, quieter_name: str) -> Dict[str, Any]:
        """Politely balance speaking turns when one participant dominates."""
        text = f"Thank you for sharing those insights, {dominant_name}. Let's make sure all perspectives are heard—{quieter_name}, how do you view this issue?"
        return {
            "type": "MODERATOR_SPEAK",
            "text": text,
            "gesture": "THINKING_TILT",
            "expression": "PROFESSIONAL_SERIOUS",
            "reason": "balance_speaking_turns",
        }

    def record_transcript(
        self,
        session_id: uuid.UUID,
        participant_id: Optional[uuid.UUID],
        speaker_name: str,
        message: str,
        timestamp_seconds: float = 0.0,
        is_moderator: bool = False,
    ) -> GDTranscript:
        """Persist finalized transcript segment to database with sequence number."""
        last_item = (
            self.db.query(GDTranscript)
            .filter(GDTranscript.session_id == session_id)
            .order_by(GDTranscript.sequence_number.desc())
            .first()
        )
        seq = (last_item.sequence_number + 1) if last_item else 1

        transcript = GDTranscript(
            session_id=session_id,
            participant_id=participant_id,
            speaker_name=speaker_name,
            is_moderator=is_moderator,
            message=message.strip(),
            timestamp_seconds=round(timestamp_seconds, 2),
            sequence_number=seq,
        )
        self.db.add(transcript)
        self.db.commit()
        self.db.refresh(transcript)
        return transcript

    def evaluate_moderation_turn(
        self,
        session: GDSession,
        recent_transcripts: List[GDTranscript],
        elapsed_seconds: float,
        remaining_seconds: float,
        cooldown_seconds: float = 25.0,
        force: bool = False,
        silence_seconds: float = 0.0,
        quieter_participant_name: Optional[str] = None,
        dominant_participant_name: Optional[str] = None,
        is_candidate_speaking: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate if Sarah should interject with rate limiting, silence detection,
        turn balancing, and cooldown protection. Never interrupts active candidate speech.
        """
        # Hard rule: never interrupt while a candidate is actively speaking
        if is_candidate_speaking:
            return None

        session_key = str(session.id)
        now = time.time()
        last_time = self._last_intervention_epoch.get(session_key, 0.0)

        # 1. Check time warnings (highest priority)
        warnings_set = self._given_time_warnings.setdefault(session_key, set())

        if remaining_seconds <= 60 and "1_min" not in warnings_set:
            warnings_set.add("1_min")
            self._last_intervention_epoch[session_key] = now
            return {
                "type": "MODERATOR_SPEAK",
                "text": "We have approximately one minute remaining. Please begin summarizing your final thoughts and key takeaways.",
                "gesture": "THINKING_TILT",
                "expression": "WARM_SMILE",
                "reason": "time_warning_1min",
            }

        if remaining_seconds <= 120 and remaining_seconds > 60 and "2_min" not in warnings_set and session.duration_minutes >= 3:
            warnings_set.add("2_min")
            self._last_intervention_epoch[session_key] = now
            return {
                "type": "MODERATOR_SPEAK",
                "text": "We are at the two-minute mark. Let's begin synthesizing our key perspectives and working toward a consensus.",
                "gesture": "THINKING_TILT",
                "expression": "WARM_SMILE",
                "reason": "time_warning_2min",
            }

        if remaining_seconds <= 300 and remaining_seconds > 240 and "5_min" not in warnings_set and session.duration_minutes >= 10:
            warnings_set.add("5_min")
            self._last_intervention_epoch[session_key] = now
            return {
                "type": "MODERATOR_SPEAK",
                "text": "We have five minutes remaining in our discussion. If anyone hasn't shared their perspective yet, please feel free to jump in.",
                "gesture": "THINKING_TILT",
                "expression": "WARM_SMILE",
                "reason": "time_warning_5min",
            }

        # 2. Check cooldown protection unless forced (minimum 45s between Sarah statements)
        if not force and (now - last_time < cooldown_seconds):
            return None

        # 3. Prolonged silence handling: intervene ONLY after 3-4 minutes (180s) in production,
        # or when force=True in test harnesses with silence >= 20s
        if silence_seconds >= 180.0 or (force and silence_seconds >= 20.0):
            self._last_intervention_epoch[session_key] = now
            return self.generate_silence_prompt(
                topic=session.topic,
                quieter_name=quieter_participant_name,
                recent_transcripts=recent_transcripts,
            )

        if force:
            self._last_intervention_epoch[session_key] = now
            return {
                "type": "MODERATOR_SPEAK",
                "text": "That's an interesting point. Could someone offer a supporting example or a counter perspective on that?",
                "gesture": "THINKING_TILT",
                "expression": "WARM_SMILE",
                "reason": "forced_prompt",
            }

        # 4. Normal Discussion: Sarah remains silent to allow participant-to-participant dialogue
        return None

    def generate_closing(self, topic: str, transcripts: List[GDTranscript]) -> str:
        """Generate Sarah's concluding remarks debriefing the discussion."""
        transcript_snippets = "\n".join(
            [f"- {t.speaker_name}: {t.message[:100]}" for t in transcripts[-10:] if not t.is_moderator]
        ) if transcripts else "Active participation from all members."

        prompt = (
            f"You are Sarah Jenkins, concluding an AI Group Discussion.\n"
            f"Topic: {topic}\n"
            f"Key discussion excerpts:\n{transcript_snippets}\n\n"
            "Deliver a concise, encouraging conclusion (approx 50-60 words).\n"
            "Summarize the main threads of the discussion, thank the participants for their collaboration, "
            "and instruct them to review their personalized feedback dashboards. Plain text, no markdown."
        )

        try:
            res = self.llm_manager.generate(
                prompt=prompt,
                system_prompt="You are Sarah Jenkins. Return plain spoken closing remarks.",
                temperature=0.7,
                max_tokens=180,
            )
            if res.success and res.content:
                clean_text = res.content.strip().replace('"', "")
                if len(clean_text) > 30:
                    return clean_text
        except Exception as e:
            logger.warning(f"Error generating closing remarks: {e}")

        return (
            "Thank you everyone for a thoughtful and engaging discussion. "
            "We heard compelling perspectives today on both sides of the topic. "
            "Our discussion time has concluded. Please open your individual feedback reports on your dashboard to review your personalized communication and teamwork evaluation."
        )
