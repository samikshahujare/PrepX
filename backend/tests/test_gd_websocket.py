import json
import pytest
from app.models.user import User
from app.models.gd import GDSession, GDParticipant
from app.services.gd_service import GDService
from app.schemas.gd import GDSessionCreate


def test_gd_websocket_room_lifecycle(client, db_session):
    # 1. Create a user and GD session
    user = User(email="ws_host@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Is remote engineering collaboration as effective as in-office pairing?",
            topic_category="Workplace & Management Scenarios",
            duration_minutes=15,
            max_participants=6,
        ),
        host_name="Host Jordan",
    )
    host_participant = session.participants[0]

    # Add second participant
    peer_participant = gd_service.join_participant(
        session_id=session.id,
        display_name="Peer Taylor",
        guest_id="guest_peer_taylor",
    )

    # 2. Connect Host WebSocket
    with client.websocket_connect(f"/api/v1/gd/ws/{session.session_code}?participant_id={host_participant.id}") as ws_host:
        init_msg = ws_host.receive_json()
        assert init_msg["type"] == "ROOM_STATE"
        assert init_msg["session_code"] == session.session_code
        assert "participants" in init_msg

        # 3. Connect Peer WebSocket
        with client.websocket_connect(f"/api/v1/gd/ws/{session.session_code}?participant_id={peer_participant.id}") as ws_peer:
            peer_init = ws_peer.receive_json()
            assert peer_init["type"] == "ROOM_STATE"

            # Host should receive PARTICIPANT_JOINED
            host_event = ws_host.receive_json()
            assert host_event["type"] == "PARTICIPANT_JOINED"
            assert host_event["participant"]["display_name"] == "Peer Taylor"

            # 4. Peer sends audio chunk
            test_audio_payload = {
                "type": "audio_chunk",
                "participant_id": str(peer_participant.id),
                "data": "base64audiobytesmock==",
            }
            ws_peer.send_json(test_audio_payload)

            # Host should receive the relayed audio chunk
            relayed_audio = ws_host.receive_json()
            assert relayed_audio["type"] == "AUDIO_RELAY"
            assert relayed_audio["sender_id"] == str(peer_participant.id)
            assert relayed_audio["data"] == "base64audiobytesmock=="

        # 5. When Peer disconnects, Host should receive PARTICIPANT_LEFT
        left_event = ws_host.receive_json()
        assert left_event["type"] == "PARTICIPANT_LEFT"
        assert left_event["participant_id"] == str(peer_participant.id)


def test_gd_websocket_speaker_attribution_and_echo_suppression(client, db_session, monkeypatch):
    from app.services.gd_moderator_service import GDModeratorService

    monkeypatch.setattr(
        GDModeratorService,
        "generate_opening",
        lambda self, topic, duration_minutes: f"Welcome, everyone. I am Sarah Jenkins. Today's topic is: {topic}."
    )

    user = User(email="attrib_host@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Should teams mandate 100% test coverage before shipping?",
            topic_category="Technology & AI",
            duration_minutes=15,
            max_participants=4,
        ),
        host_name="Host Jordan",
    )
    host_participant = session.participants[0]

    peer_participant = gd_service.join_participant(
        session_id=session.id,
        display_name="Peer Riley",
        guest_id="guest_peer_riley",
    )

    with client.websocket_connect(f"/api/v1/gd/ws/{session.session_code}?participant_id={host_participant.id}") as ws_host:
        ws_host.receive_json()  # ROOM_STATE

        with client.websocket_connect(f"/api/v1/gd/ws/{session.session_code}?participant_id={peer_participant.id}") as ws_peer:
            ws_peer.receive_json()  # ROOM_STATE
            ws_host.receive_json()  # PARTICIPANT_JOINED

            # 1. Host triggers START_DISCUSSION -> Sarah gives MODERATOR_OPENING
            ws_host.send_json({"type": "START_DISCUSSION"})

            mod_opening_host = ws_host.receive_json()
            assert mod_opening_host["type"] == "MODERATOR_OPENING"
            assert "statement" in mod_opening_host

            mod_opening_peer = ws_peer.receive_json()
            assert mod_opening_peer["type"] == "MODERATOR_OPENING"
            assert mod_opening_peer["statement"] == mod_opening_host["statement"]

            # 2. Second START_DISCUSSION from host is safely ignored (duplicate opening prevented)
            ws_host.send_json({"type": "START_DISCUSSION"})
            # No duplicate broadcast should arrive

            # 3. Peer sends a genuine voice transcript segment
            peer_message = "I believe pragmatism is key and critical paths require high coverage."
            ws_peer.send_json({
                "type": "TRANSCRIPT_CHUNK",
                "message": peer_message,
                "is_final": True,
                "is_manual": False,
                "timestamp_seconds": 12.0,
            })

            # Both host and peer should receive the properly attributed transcript
            chunk_host = ws_host.receive_json()
            assert chunk_host["type"] == "TRANSCRIPT_CHUNK"
            assert chunk_host["participant_id"] == str(peer_participant.id)
            assert chunk_host["speaker_name"] == "Peer Riley"
            assert chunk_host["is_moderator"] is False
            assert chunk_host["message"] == peer_message

            chunk_peer = ws_peer.receive_json()
            assert chunk_peer["type"] == "TRANSCRIPT_CHUNK"
            assert chunk_peer["speaker_name"] == "Peer Riley"

            # 4. Immediate duplicate transcript segment (<2s) should be dropped
            ws_peer.send_json({
                "type": "TRANSCRIPT_CHUNK",
                "message": peer_message,
                "is_final": True,
                "timestamp_seconds": 12.5,
            })
            # No duplicate chunk broadcast

