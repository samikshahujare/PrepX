import json
import logging
import random
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import NotFoundException, ValidationException
from app.models.gd import (
    GDSession,
    GDParticipant,
    GDInvitationToken,
    GDTranscript,
    GDEvaluation,
)
from app.schemas.gd import GDSessionCreate
from app.services.llm_service import LLMProviderManager

logger = logging.getLogger("prepx.gd_service")

# Curated Fallback Topics by Category (used if LLM is offline or in mock mode)
TOPIC_CATALOG: Dict[str, List[Dict[str, Any]]] = {
    "Technology & AI": [
        {
            "topic": "Will Artificial Intelligence create more high-value employment than it automates?",
            "briefing": "As generative AI and agentic systems accelerate automation, industries face workforce realignment. The discussion focuses on whether net-new professions will outpace displaced roles.",
            "key_perspectives": ["Technological optimism & augmentation", "Structural unemployment & reskilling barriers", "Economic productivity dividend"],
        },
        {
            "topic": "Should autonomous decision-making systems in healthcare and hiring be subject to strict statutory audits?",
            "briefing": "Algorithmic bias and black-box models create critical ethical dilemmas in sensitive sectors. Discuss balance between regulatory speed and public protection.",
            "key_perspectives": ["Mandatory explainability & human-in-the-loop", "Stifling technological innovation", "Standardized liability frameworks"],
        },
    ],
    "Business & Economy": [
        {
            "topic": "Remote vs Hybrid vs Full In-Office: What represents the optimal long-term strategy for tech firms?",
            "briefing": "Tech enterprises balance productivity metrics, employee retention, and corporate culture cohesion across distributed team structures.",
            "key_perspectives": ["Global talent access & flexibility", "Mentorship erosion & spontaneous innovation", "Hybrid compromise efficiency"],
        },
        {
            "topic": "Is rapid growth at all costs still a viable strategy for early-stage venture startups?",
            "briefing": "In a high-interest-rate macroeconomic environment, sustainable unit economics and profitability often supersede blitzscaling.",
            "key_perspectives": ["First-mover network effects", "Cash-flow discipline & durability", "Investor risk tolerance shifting"],
        },
    ],
    "Social & Ethical Issues": [
        {
            "topic": "Data Sovereignty vs Global Cloud: Can global digital trade survive fragmented regional data regulations?",
            "briefing": "Cross-border data transfer laws clash with global cloud architectures and international engineering cooperation.",
            "key_perspectives": ["National security & citizen privacy rights", "Compliance overhead for startups", "Decentralized data architectures"],
        },
    ],
    "Workplace & Management Scenarios": [
        {
            "topic": "How should engineering leadership resolve deep architectural disagreements between Senior Engineers?",
            "briefing": "When technical leads disagree on architecture (e.g. Microservices vs Monolith, Rust vs Go), leadership must balance speed, team consensus, and technical debt.",
            "key_perspectives": ["Consensus building & RFC reviews", "Leadership decisiveness to prevent deadlock", "Proof-of-concept experiments with metrics"],
        },
    ],
    "Current Affairs & Industry": [
        {
            "topic": "Sustainable Computing: Should cloud providers and AI data centers be taxed on carbon and water footprints?",
            "briefing": "The massive energy consumption of modern deep learning training clusters creates growing environmental friction with local municipal grids.",
            "key_perspectives": ["Incentivizing renewable energy adoption", "Passing costs to consumers and developers", "Technological breakthroughs in silicon efficiency"],
        },
    ],
}


class GDService:
    def __init__(self, db: Session):
        self.db = db
        self.llm_manager = LLMProviderManager()

    def generate_topic(
        self,
        category: str = "Technology & AI",
        role_context: Optional[str] = None,
        company: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a realistic, balanced GD topic using LLM with deterministic catalog fallback."""
        prompt = (
            f"You are Sarah Jenkins, an expert moderator for technical group discussions.\n"
            f"Generate a thought-provoking, balanced Group Discussion topic for candidates.\n"
            f"Category: {category}\n"
            f"Target Role: {role_context or 'General Technical/Business Professional'}\n"
            f"Target Company: {company or 'Technology Industry'}\n\n"
            "Return ONLY a valid JSON object with the following keys:\n"
            "{\n"
            '  "topic": "A concise, engaging discussion proposition (under 120 chars)",\n'
            '  "category": "' + category + '",\n'
            '  "briefing": "A 2-3 sentence background summary of the core dilemma.",\n'
            '  "key_perspectives": ["Perspective A", "Perspective B", "Perspective C"]\n'
            "}"
        )

        try:
            response = self.llm_manager.generate(
                prompt=prompt,
                system_prompt="You are an expert Group Discussion moderator. You only reply with strictly valid JSON.",
                json_mode=True,
                temperature=0.7,
                max_tokens=400,
            )
            if response.success and response.content:
                text = response.content.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                parsed = json.loads(text)
                if "topic" in parsed and "briefing" in parsed:
                    parsed["category"] = category
                    return parsed
        except Exception as e:
            logger.warning(f"LLM topic generation encountered error, falling back to curated catalog: {e}")

        # Deterministic fallback from catalog
        available = TOPIC_CATALOG.get(category) or TOPIC_CATALOG["Technology & AI"]
        chosen = random.choice(available)
        return {
            "topic": chosen["topic"],
            "category": category,
            "briefing": chosen["briefing"],
            "key_perspectives": chosen.get("key_perspectives", []),
        }

    def _generate_session_code(self) -> str:
        """Generate a unique human-friendly session code (e.g., PREPX-GD-98241)."""
        for _ in range(10):
            random_digits = "".join(random.choices(string.digits, k=5))
            code = f"PREPX-GD-{random_digits}"
            existing = self.db.query(GDSession).filter(GDSession.session_code == code).first()
            if not existing:
                return code
        return f"PREPX-GD-{uuid.uuid4().hex[:6].upper()}"

    def create_session(
        self,
        creator_id: uuid.UUID,
        data: GDSessionCreate,
        host_name: str = "Host",
    ) -> GDSession:
        """Create a new GD session and register the host as the first participant."""
        session_code = self._generate_session_code()
        session = GDSession(
            session_code=session_code,
            creator_id=creator_id,
            topic=data.topic,
            topic_category=data.topic_category,
            topic_context=data.topic_context,
            duration_minutes=data.duration_minutes,
            max_participants=data.max_participants,
            status="waiting_for_participants",
        )
        self.db.add(session)
        self.db.flush()

        # Add host participant
        host_participant = GDParticipant(
            session_id=session.id,
            user_id=creator_id,
            display_name=host_name,
            is_host=True,
            is_muted=False,
        )
        self.db.add(host_participant)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session_by_id_or_code(self, identifier: str) -> GDSession:
        """Retrieve a session by either UUID string or session code."""
        query = self.db.query(GDSession)
        try:
            val_uuid = uuid.UUID(identifier)
            session = query.filter(GDSession.id == val_uuid).first()
        except ValueError:
            session = query.filter(GDSession.session_code == identifier.upper()).first()

        if not session:
            raise NotFoundException(f"Group Discussion session '{identifier}' not found.")
        return session

    def list_user_sessions(self, user_id: uuid.UUID) -> List[GDSession]:
        """List sessions where user is either creator or participant."""
        return (
            self.db.query(GDSession)
            .outerjoin(GDParticipant, GDParticipant.session_id == GDSession.id)
            .filter((GDSession.creator_id == user_id) | (GDParticipant.user_id == user_id))
            .distinct()
            .order_by(GDSession.created_at.desc())
            .all()
        )

    def create_invitation(self, session_id: uuid.UUID, base_url: Optional[str] = None) -> GDInvitationToken:
        """Generate a cryptographically secure invitation token for the session."""
        session = self.db.query(GDSession).filter(GDSession.id == session_id).first()
        if not session:
            raise NotFoundException("Session not found.")

        # Check for existing active token
        existing = (
            self.db.query(GDInvitationToken)
            .filter(
                GDInvitationToken.session_id == session_id,
                GDInvitationToken.is_active == True,
                GDInvitationToken.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )
        if existing:
            return existing

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        invite = GDInvitationToken(
            session_id=session_id,
            token=token,
            expires_at=expires_at,
            is_active=True,
        )
        self.db.add(invite)
        self.db.commit()
        self.db.refresh(invite)
        return invite

    def validate_invitation(self, token: str) -> Dict[str, Any]:
        """Validate an invitation token and return session metadata for the join page."""
        invite = (
            self.db.query(GDInvitationToken)
            .filter(GDInvitationToken.token == token)
            .first()
        )
        if not invite or not invite.is_active:
            raise ValidationException("This Group Discussion invitation link is invalid or has been revoked.")

        expires = invite.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise ValidationException("This Group Discussion invitation link has expired.")

        session = invite.session
        if session.status in ["completed", "cancelled"]:
            raise ValidationException(f"This discussion session has already {session.status}.")

        participants_count = len(session.participants)
        is_full = participants_count >= session.max_participants

        host_name = "Host"
        for p in session.participants:
            if p.is_host:
                host_name = p.display_name
                break

        return {
            "is_valid": True,
            "token": token,
            "session": {
                "id": str(session.id),
                "session_code": session.session_code,
                "topic": session.topic,
                "topic_category": session.topic_category,
                "topic_context": session.topic_context,
                "duration_minutes": session.duration_minutes,
                "status": session.status,
                "host_name": host_name,
            },
            "current_participants": participants_count,
            "max_participants": session.max_participants,
            "is_full": is_full,
        }

    def join_participant(
        self,
        session_id: uuid.UUID,
        display_name: str,
        user_id: Optional[uuid.UUID] = None,
        guest_id: Optional[str] = None,
    ) -> GDParticipant:
        """Idempotently add participant to session (reconnect safe)."""
        session = self.db.query(GDSession).filter(GDSession.id == session_id).first()
        if not session:
            raise NotFoundException("Session not found.")

        if session.status in ["completed", "cancelled"]:
            raise ValidationException(f"Cannot join discussion: session is {session.status}.")

        # Check if already joined (idempotency check)
        existing_participant = None
        if user_id:
            existing_participant = (
                self.db.query(GDParticipant)
                .filter(GDParticipant.session_id == session_id, GDParticipant.user_id == user_id)
                .first()
            )
        elif guest_id:
            existing_participant = (
                self.db.query(GDParticipant)
                .filter(GDParticipant.session_id == session_id, GDParticipant.guest_id == guest_id)
                .first()
            )

        if existing_participant:
            # Update display name if changed and return existing record
            if display_name and existing_participant.display_name != display_name:
                existing_participant.display_name = display_name
                self.db.commit()
                self.db.refresh(existing_participant)
            return existing_participant

        # Check participant limit
        current_count = len(session.participants)
        if current_count >= session.max_participants:
            raise ValidationException(f"This session has reached its limit of {session.max_participants} participants.")

        new_participant = GDParticipant(
            session_id=session_id,
            user_id=user_id,
            guest_id=guest_id or (f"guest_{uuid.uuid4().hex[:8]}" if not user_id else None),
            display_name=display_name,
            is_host=False,
            is_muted=False,
        )
        self.db.add(new_participant)
        self.db.commit()
        self.db.refresh(new_participant)
        return new_participant

    def format_share_links(self, session: GDSession, token: str, base_url: Optional[str] = None) -> Dict[str, str]:
        """Generate WhatsApp and Email sharing URLs for the session."""
        base = (base_url or settings.canonical_frontend_url).strip().rstrip("/")
        join_url = f"{base}/gd/join/{token}"
        wa_message = (
            f"You have been invited to a PrepX Group Discussion!\n\n"
            f"Topic: {session.topic}\n"
            f"Duration: {session.duration_minutes} minutes\n"
            f"Session Code: {session.session_code}\n\n"
            f"Join discussion room here: {join_url}"
        )
        whatsapp_share_url = f"https://api.whatsapp.com/send?text={quote_plus(wa_message)}"

        email_subject = f"PrepX Invitation: Group Discussion on '{session.topic[:40]}...'"
        email_body = (
            f"Hello,\n\nYou have been invited to participate in an AI-moderated Group Discussion on PrepX.\n\n"
            f"Topic: {session.topic}\n"
            f"Duration: {session.duration_minutes} minutes\n"
            f"Session Code: {session.session_code}\n\n"
            f"Please click the link below to verify your audio and join the live room:\n{join_url}\n\n"
            f"AI Moderator: Sarah Jenkins\nPrepX Platform"
        )

        return {
            "token": token,
            "join_url": join_url,
            "whatsapp_share_url": whatsapp_share_url,
            "email_share_subject": email_subject,
            "email_share_body": email_body,
        }
