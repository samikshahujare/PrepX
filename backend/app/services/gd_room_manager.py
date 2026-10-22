import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket
from app.db.session import SessionLocal
from app.models.gd import GDSession, GDTranscript
from app.services.gd_moderator_service import GDModeratorService

logger = logging.getLogger("prepx.gd_room_manager")


class GDRoom:
    def __init__(self, session_code: str):
        self.session_code = session_code
        self.connections: Dict[str, WebSocket] = {}  # participant_id -> WebSocket
        self.metadata: Dict[str, Dict[str, Any]] = {}  # participant_id -> info
        self.is_active: bool = True
        self.status: str = "waiting"  # "waiting", "in_progress", "completed"
        self.started_at: Optional[float] = None
        self.duration_minutes: int = 15
        self.topic: str = ""
        self.session_id: Optional[uuid.UUID] = None

        # Real-time audio and speaker tracking
        self.active_speakers: Set[str] = set()
        self._speaker_decay_tasks: Dict[str, asyncio.Task] = {}
        self.last_speech_epoch: float = time.time()

        # Sarah Jenkins AI Host and Moderator state
        self.sarah_speaking: bool = False
        self.sarah_speaking_until: float = 0.0
        self.has_opened: bool = False
        self.has_concluded: bool = False
        self.last_intervention_epoch: float = 0.0
        self.silence_prompts_count: int = 0
        self.time_warnings_sent: Set[str] = set()

        # Participation metrics: participant_id -> metrics dict
        self.participation: Dict[str, Dict[str, Any]] = {}

        # Autonomous loop task
        self.loop_task: Optional[asyncio.Task] = None

    def add_participant(
        self,
        participant_id: str,
        websocket: WebSocket,
        display_name: str,
        is_host: bool = False,
    ):
        self.connections[participant_id] = websocket
        self.metadata[participant_id] = {
            "id": participant_id,
            "participant_id": participant_id,
            "display_name": display_name,
            "is_host": is_host,
            "is_muted": False,
        }
        if participant_id not in self.participation:
            self.participation[participant_id] = {
                "turn_count": 0,
                "word_count": 0,
                "last_spoken": 0.0,
                "display_name": display_name,
                "is_host": is_host,
            }

    def remove_participant(self, participant_id: str):
        self.connections.pop(participant_id, None)
        self.metadata.pop(participant_id, None)
        self.active_speakers.discard(participant_id)
        decay_task = self._speaker_decay_tasks.pop(participant_id, None)
        if decay_task and not decay_task.done():
            decay_task.cancel()

    def get_participants_list(self) -> List[Dict[str, Any]]:
        return list(self.metadata.values())

    def record_speaking_chunk(self, participant_id: str):
        """Track active voice transmission with automatic 450ms decay."""
        self.active_speakers.add(participant_id)
        self.last_speech_epoch = time.time()

        old_task = self._speaker_decay_tasks.get(participant_id)
        if old_task and not old_task.done():
            old_task.cancel()

        async def _decay():
            try:
                await asyncio.sleep(0.45)
                self.active_speakers.discard(participant_id)
            except asyncio.CancelledError:
                pass

        self._speaker_decay_tasks[participant_id] = asyncio.create_task(_decay())

    def record_transcript_chunk(self, participant_id: Optional[str], message: str, is_moderator: bool):
        """Update room silence timer and participant turn metrics."""
        self.last_speech_epoch = time.time()
        if not is_moderator:
            self.silence_prompts_count = 0
            if participant_id and participant_id in self.participation:
                self.participation[participant_id]["turn_count"] += 1
                self.participation[participant_id]["word_count"] += len(message.split())
                self.participation[participant_id]["last_spoken"] = time.time()

    def get_quieter_participant(self) -> Optional[Dict[str, Any]]:
        """Identify connected participant with the least contributions."""
        connected_ids = set(self.connections.keys())
        active_candidates = [
            (pid, data) for pid, data in self.participation.items()
            if pid in connected_ids
        ]
        if len(active_candidates) < 2:
            return None

        # Sort by turn_count ascending, then word_count ascending
        active_candidates.sort(key=lambda item: (item[1]["turn_count"], item[1]["word_count"], item[1]["last_spoken"]))
        max_turns = max(d["turn_count"] for _, d in active_candidates)
        min_turns = active_candidates[0][1]["turn_count"]

        # Only target quiet speaker if there is an imbalance
        if max_turns >= 2 and min_turns <= 1:
            return active_candidates[0][1]
        return None

    def get_dominant_participant(self) -> Optional[Dict[str, Any]]:
        """Identify if a participant has taken disproportionate turns (>55% after 4+ turns)."""
        connected_ids = set(self.connections.keys())
        active_candidates = [
            (pid, data) for pid, data in self.participation.items()
            if pid in connected_ids
        ]
        if len(active_candidates) < 2:
            return None

        total_turns = sum(d["turn_count"] for _, d in active_candidates)
        if total_turns >= 4:
            for _, d in active_candidates:
                if d["turn_count"] / total_turns > 0.55:
                    return d
        return None


class GDRoomManager:
    _instance: Optional["GDRoomManager"] = None

    def __init__(self):
        self.rooms: Dict[str, GDRoom] = {}

    @classmethod
    def get_instance(cls) -> "GDRoomManager":
        if cls._instance is None:
            cls._instance = GDRoomManager()
        return cls._instance

    def get_or_create_room(self, session_code: str) -> GDRoom:
        session_code_norm = session_code.upper()
        if session_code_norm not in self.rooms:
            self.rooms[session_code_norm] = GDRoom(session_code_norm)
        return self.rooms[session_code_norm]

    async def connect(
        self,
        session_code: str,
        participant_id: str,
        websocket: WebSocket,
        display_name: str,
        is_host: bool = False,
        topic: str = "",
        duration_minutes: int = 15,
        session_id: Optional[uuid.UUID] = None,
    ):
        await websocket.accept()
        room = self.get_or_create_room(session_code)
        room.session_id = session_id or room.session_id
        room.topic = topic or room.topic
        room.duration_minutes = duration_minutes or room.duration_minutes
        room.add_participant(participant_id, websocket, display_name, is_host)

        # Calculate accurate remaining time if session is in progress
        remaining = room.duration_minutes * 60
        if room.status == "in_progress" and room.started_at:
            elapsed = time.time() - room.started_at
            remaining = max(0, int(room.duration_minutes * 60 - elapsed))

        # 1. Send initial ROOM_STATE to the joining participant
        state_payload = {
            "type": "ROOM_STATE",
            "session_code": room.session_code,
            "topic": room.topic,
            "duration_minutes": room.duration_minutes,
            "status": room.status,
            "remaining_seconds": remaining,
            "participants": room.get_participants_list(),
        }
        await websocket.send_json(state_payload)

        # 2. Broadcast PARTICIPANT_JOINED to other connected peers
        joined_notification = {
            "type": "PARTICIPANT_JOINED",
            "participant": room.metadata[participant_id],
        }
        await self.broadcast(session_code, joined_notification, exclude_participant_id=participant_id)

    async def disconnect(self, session_code: str, participant_id: str):
        session_code_norm = session_code.upper()
        room = self.rooms.get(session_code_norm)
        if not room:
            return

        room.remove_participant(participant_id)
        if len(room.connections) == 0:
            if room.loop_task and not room.loop_task.done():
                room.loop_task.cancel()
            self.rooms.pop(session_code_norm, None)
        else:
            left_notification = {
                "type": "PARTICIPANT_LEFT",
                "participant_id": participant_id,
            }
            await self.broadcast(session_code_norm, left_notification)

    async def broadcast(
        self,
        session_code: str,
        message: Dict[str, Any],
        exclude_participant_id: Optional[str] = None,
    ):
        room = self.rooms.get(session_code.upper())
        if not room:
            return

        disconnected_ids = []
        for pid, ws in list(room.connections.items()):
            if exclude_participant_id and pid == exclude_participant_id:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting to participant {pid}: {e}")
                disconnected_ids.append(pid)

        for pid in disconnected_ids:
            room.remove_participant(pid)

    async def relay_audio(
        self,
        session_code: str,
        sender_id: str,
        audio_data: str,
        sample_rate: int = 44100,
    ):
        """Relays self-contained linear PCM frames and updates voice activity tracking."""
        room = self.rooms.get(session_code.upper())
        if room:
            room.record_speaking_chunk(sender_id)

        payload = {
            "type": "AUDIO_RELAY",
            "sender_id": sender_id,
            "audio_data": audio_data,
            "data": audio_data,
            "sample_rate": sample_rate,
        }
        await self.broadcast(session_code, payload, exclude_participant_id=sender_id)

    async def update_mute_state(
        self,
        session_code: str,
        participant_id: str,
        is_muted: bool,
    ):
        room = self.rooms.get(session_code.upper())
        if not room or participant_id not in room.metadata:
            return
        room.metadata[participant_id]["is_muted"] = is_muted
        if is_muted:
            room.active_speakers.discard(participant_id)

        event = {
            "type": "MUTE_STATE_CHANGED",
            "participant_id": participant_id,
            "is_muted": is_muted,
        }
        await self.broadcast(session_code, event)

    def start_autonomous_moderator(self, session_code: str):
        """Starts the autonomous moderation ticker loop for the session."""
        session_code_norm = session_code.upper()
        room = self.rooms.get(session_code_norm)
        if not room:
            return

        if room.loop_task and not room.loop_task.done():
            return  # Already running

        room.status = "in_progress"
        room.started_at = room.started_at or time.time()
        room.last_speech_epoch = time.time()
        room.loop_task = asyncio.create_task(self._moderator_loop(session_code_norm))

    async def _moderator_loop(self, session_code: str):
        """
        Autonomous background loop monitoring room time, silence, and participant turns.
        Executes without requiring participant transcript input.
        """
        logger.info(f"[GDRoomManager] Autonomous moderator loop active for {session_code}")
        while True:
            try:
                await asyncio.sleep(5)
                room = self.rooms.get(session_code)
                if not room or not room.is_active or room.status != "in_progress":
                    break

                now = time.time()
                elapsed = now - (room.started_at or now)
                remaining = max(0.0, (room.duration_minutes * 60) - elapsed)

                # 1. Automatic Session Conclusion when time expires
                if remaining <= 0 and not room.has_concluded:
                    room.has_concluded = True
                    room.status = "completed"
                    await self._trigger_autonomous_conclusion(room)
                    break

                # 2. Hard Gate: Never interrupt when a candidate is speaking or Sarah is speaking
                if room.active_speakers or room.sarah_speaking or now < room.sarah_speaking_until:
                    continue

                # 3. Minimum cooldown of 25 seconds between Sarah interventions
                if now - room.last_intervention_epoch < 25.0:
                    continue

                # 4. Check for Time Warnings or Silence using DB session
                db = SessionLocal()
                try:
                    sess = None
                    if room.session_id:
                        sess = db.query(GDSession).filter(GDSession.id == room.session_id).first()

                    if sess:
                        recent_t = (
                            db.query(GDTranscript)
                            .filter(GDTranscript.session_id == sess.id)
                            .order_by(GDTranscript.sequence_number.desc())
                            .limit(5)
                            .all()
                        )
                        recent_t.reverse()

                        silence_duration = now - room.last_speech_epoch
                        quieter_part = room.get_quieter_participant()
                        dominant_part = room.get_dominant_participant()

                        # Avoid repeating silence prompt more than twice consecutively
                        effective_silence = silence_duration if room.silence_prompts_count < 2 else 0.0

                        mod_svc = GDModeratorService(db)
                        intervention = mod_svc.evaluate_moderation_turn(
                            session=sess,
                            recent_transcripts=recent_t,
                            elapsed_seconds=elapsed,
                            remaining_seconds=remaining,
                            silence_seconds=effective_silence,
                            quieter_participant_name=quieter_part["display_name"] if quieter_part else None,
                            dominant_participant_name=dominant_part["display_name"] if dominant_part else None,
                            is_candidate_speaking=len(room.active_speakers) > 0,
                        )

                        if intervention:
                            if "silence_breaker" in intervention.get("reason", ""):
                                room.silence_prompts_count += 1

                            room.last_intervention_epoch = now
                            room.last_speech_epoch = now
                            # Estimate Sarah speech duration (approx 200 words/min = 3.3 words/sec + 1.5s padding)
                            words = len(intervention["text"].split())
                            est_dur = max(3.5, (words / 3.0) + 1.5)
                            room.sarah_speaking_until = now + est_dur

                            mod_t = mod_svc.record_transcript(
                                session_id=sess.id,
                                participant_id=None,
                                speaker_name="Sarah Jenkins",
                                message=intervention["text"],
                                timestamp_seconds=round(elapsed, 2),
                                is_moderator=True,
                            )

                            await self.broadcast(
                                session_code,
                                {
                                    "type": "MODERATOR_INTERVENTION",
                                    "speaker_name": "Sarah Jenkins",
                                    "statement": intervention["text"],
                                    "intervention": intervention["text"],
                                    "message": intervention["text"],
                                    "gesture": intervention.get("gesture", "THINKING_TILT"),
                                    "expression": intervention.get("expression", "WARM_SMILE"),
                                    "reason": intervention.get("reason", "moderation"),
                                    "sequence_number": mod_t.sequence_number,
                                },
                            )
                finally:
                    db.close()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[GDRoomManager] Exception in moderator loop: {e}", exc_info=True)

    async def _trigger_autonomous_conclusion(self, room: GDRoom):
        """Concludes the discussion autonomously and broadcasts closing remarks."""
        db = SessionLocal()
        try:
            sess = None
            if room.session_id:
                sess = db.query(GDSession).filter(GDSession.id == room.session_id).first()

            if sess:
                sess.status = "completed"
                db.commit()

                all_transcripts = (
                    db.query(GDTranscript)
                    .filter(GDTranscript.session_id == sess.id)
                    .order_by(GDTranscript.sequence_number.asc())
                    .all()
                )
                mod_svc = GDModeratorService(db)
                closing = mod_svc.generate_closing(topic=sess.topic, transcripts=all_transcripts)
                mod_t = mod_svc.record_transcript(
                    session_id=sess.id,
                    participant_id=None,
                    speaker_name="Sarah Jenkins",
                    message=closing,
                    timestamp_seconds=float(room.duration_minutes * 60),
                    is_moderator=True,
                )

                await self.broadcast(
                    room.session_code,
                    {
                        "type": "SESSION_COMPLETED",
                        "moderator_closing": closing,
                        "statement": closing,
                        "session_id": str(sess.id),
                        "sequence_number": mod_t.sequence_number,
                    },
                )
        finally:
            db.close()


gd_room_manager = GDRoomManager.get_instance()
