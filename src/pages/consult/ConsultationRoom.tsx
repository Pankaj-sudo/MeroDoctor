import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCallSession } from '../../hooks/useCallSession';
import { useConsultationChat } from '../../hooks/useConsultationChat';
import { useConsultationRoom } from '../../hooks/useConsultationRoom';
import { useJoinWindow } from '../../hooks/useJoinWindow';
import { FEATURED_DOCTOR } from '../../config/doctor';
import { JOIN_BLOCK_COPY, formatCountdown } from '../../lib/joinWindow';
import { endConsultationRoom, logConsultationEvent } from '../../services/videoRoomService';
import { CallControls, CallTimer, ConnectionQuality } from '../../components/video/CallControls';
import { CallErrorScreen } from '../../components/video/CallErrorScreen';
import { ChatPanel } from '../../components/video/ChatPanel';
import { VideoTile } from '../../components/video/VideoTile';
import { WaitingRoom } from '../../components/video/WaitingRoom';
import { FullPageSpinner } from '../../components/Spinner';
import '../../styles/video.css';

// ============================================================================
// The consultation room.
//
// One page, four states: gated (cannot join yet), lobby (ready to join), live
// (in the call), and ended. It never renders a vendor iframe — the layout is
// ours, so it matches MeroDoctor's espresso/cream/terracotta palette.
// ============================================================================

export function ConsultationRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { consultation, room, loading, error, isDoctorSide, role, participantIds, isParticipant } =
    useConsultationRoom(id);

  const gate = useJoinWindow(consultation);
  const call = useCallSession(id ?? '', room?.provider);

  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const displayName = profile?.displayName || user?.displayName || user?.email || 'You';

  const chatSender = useMemo(
    () => (user ? { uid: user.uid, name: displayName, role, participantIds } : null),
    [user, displayName, role, participantIds],
  );
  const chat = useConsultationChat(id ?? '', chatSender);

  // ---- the in-call timer ----
  useEffect(() => {
    if (call.phase !== 'live' || call.startedAtMs === null) return;
    const started = call.startedAtMs;
    setElapsedMs(Date.now() - started);
    const tick = setInterval(() => setElapsedMs(Date.now() - started), 1000);
    return () => clearInterval(tick);
  }, [call.phase, call.startedAtMs]);

  // ---- realtime presence: record join/leave for the other side to observe ----
  // Keyed on a STRING of the participant ids, not the array: every consultation
  // snapshot produces a fresh array, and depending on it directly would tear
  // down and re-run this effect on each one — writing a spurious
  // participant_left/participant_joined pair every time the document changed.
  const participantKey = participantIds.join(',');
  useEffect(() => {
    if (call.phase !== 'live' || !user || !participantKey || !id) return;
    const actor = { uid: user.uid, name: displayName, role, participantIds: participantKey.split(',') };
    void logConsultationEvent(id, actor, 'participant_joined');
    return () => {
      void logConsultationEvent(id, actor, 'participant_left');
    };
  }, [call.phase, user, displayName, role, participantKey, id]);

  // Mark chat read whenever the panel is open and new messages land.
  useEffect(() => {
    if (chatOpen) setSeenCount(chat.messages.length);
  }, [chatOpen, chat.messages.length]);

  const unreadCount = Math.max(0, chat.incomingCount - seenCount);

  const otherPartyName = isDoctorSide
    ? (consultation?.patient.fullName ?? 'your patient')
    : (consultation?.assignedDoctorName ?? FEATURED_DOCTOR.name);

  const leaveToDetail = useCallback(() => {
    navigate(isDoctorSide ? `/doctor/consultation/${id}` : `/track/${id}`, { replace: true });
  }, [navigate, isDoctorSide, id]);

  /**
   * The doctor ends the consultation for BOTH sides (tears the room down at the
   * provider); a patient leaving only drops their own connection, so they can
   * rejoin while the window is open.
   */
  const handleEnd = useCallback(async () => {
    setEnding(true);
    try {
      await call.leave();
      if (isDoctorSide && id) await endConsultationRoom(id);
    } catch (err) {
      console.error('[room] could not end cleanly', err);
    } finally {
      setEnding(false);
      leaveToDetail();
    }
  }, [call, isDoctorSide, id, leaveToDetail]);

  if (loading) return <FullPageSpinner label="Opening your consultation room…" />;

  if (error || !consultation) {
    return (
      <main className="v-shell">
        <div className="v-center">
          <CallErrorScreen
            error={{ kind: 'not_allowed', message: error ?? 'Consultation unavailable.', recoverable: false }}
            onLeave={() => navigate(isDoctorSide ? '/doctor' : '/consultations')}
          />
        </div>
      </main>
    );
  }

  // Belt-and-braces: the API is the real gate, but never render a room UI to
  // someone who is plainly not a participant.
  if (!isParticipant) {
    return (
      <main className="v-shell">
        <div className="v-center">
          <CallErrorScreen
            error={{ kind: 'not_allowed', message: 'This consultation is not yours.', recoverable: false }}
            onLeave={() => navigate('/consultations')}
          />
        </div>
      </main>
    );
  }

  const live = call.phase === 'live' || call.phase === 'joining';
  const screenSharer = call.participants.find((p) => p.screenOn && p.screenVideoTrack) ?? null;

  return (
    <main className={`v-shell${live ? ' is-live' : ''}`}>
      <header className="v-top">
        <div className="v-top__id">
          <span className="v-top__brand">
            MERODOCTOR <span>CONSULTATION</span>
          </span>
          <span className="v-top__with">
            {isDoctorSide ? 'Patient' : 'Clinician'} · {otherPartyName}
          </span>
        </div>
        <div className="v-top__status">
          {call.phase === 'live' ? <CallTimer elapsedMs={elapsedMs} /> : null}
          {live ? <ConnectionQuality quality={call.quality} /> : null}
          {call.connection === 'reconnecting' ? (
            <span className="v-reconnect">Reconnecting…</span>
          ) : null}
        </div>
      </header>

      <div className="v-body">
        <section className="v-stage">
          {/* ---------- fatal error ---------- */}
          {call.phase === 'error' && call.error ? (
            <div className="v-center">
              <CallErrorScreen error={call.error} onRetry={call.retry} onLeave={leaveToDetail} />
            </div>
          ) : null}

          {/* ---------- ended ---------- */}
          {call.phase === 'ended' ? (
            <div className="v-center">
              <WaitingRoom
                showSpinner={false}
                title="Consultation ended"
                message={
                  isDoctorSide
                    ? 'The room is closed. Write your notes and prescription to complete the record.'
                    : 'Thank you. Your doctor will publish your prescription and summary shortly.'
                }
              />
              <div className="v-error__actions">
                <button type="button" className="v-btn v-btn--primary" onClick={leaveToDetail}>
                  {isDoctorSide ? 'Write documentation' : 'View my consultation'}
                </button>
              </div>
            </div>
          ) : null}

          {/* ---------- cannot join yet ---------- */}
          {call.phase === 'idle' && !gate.canJoin ? (
            <div className="v-center">
              <WaitingRoom
                showSpinner={gate.reason === 'no_room' || gate.reason === 'too_early'}
                title={
                  gate.reason === 'too_early'
                    ? formatCountdown(gate.msUntilOpen)
                    : (JOIN_BLOCK_COPY[gate.reason ?? 'no_room'] ?? 'Not available')
                }
                message={
                  gate.reason === 'too_early'
                    ? `Your consultation with ${otherPartyName} opens ${gate.opensAt ? `at ${gate.opensAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'shortly'}. You can wait here — this page unlocks itself.`
                    : JOIN_BLOCK_COPY[gate.reason ?? 'no_room']
                }
              />
              <div className="v-error__actions">
                <button type="button" className="v-btn v-btn--ghost" onClick={leaveToDetail}>
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {/* ---------- lobby: ready to join ---------- */}
          {call.phase === 'idle' && gate.canJoin ? (
            <div className="v-center">
              <div className="v-lobby">
                <span className="v-lobby__eyebrow">Ready when you are</span>
                <h1 className="v-lobby__title">
                  {isDoctorSide ? `Consultation with ${otherPartyName}` : `Dr. ${otherPartyName.replace(/^Dr\.?\s*/i, '')}`}
                </h1>
                <p className="v-lobby__note">
                  Your camera and microphone start on. You can mute or turn the camera off at any
                  time once you’re in.
                </p>
                <button type="button" className="v-btn v-btn--join" onClick={() => void call.join()}>
                  Join consultation
                </button>
                <p className="v-lobby__secure">
                  🔒 Private, encrypted and limited to you and your {isDoctorSide ? 'patient' : 'doctor'}
                </p>
              </div>
            </div>
          ) : null}

          {/* ---------- preparing / joining ---------- */}
          {call.phase === 'preparing' || call.phase === 'joining' ? (
            <div className="v-center">
              <WaitingRoom
                title={call.phase === 'preparing' ? 'Securing your room' : 'Connecting'}
                message={
                  call.phase === 'preparing'
                    ? 'Verifying your access and preparing an encrypted consultation room…'
                    : 'Starting your camera and microphone…'
                }
              />
            </div>
          ) : null}

          {/* ---------- live call ---------- */}
          {call.phase === 'live' ? (
            <div className="v-grid">
              {screenSharer ? (
                <VideoTile
                  participant={screenSharer}
                  variant="stage"
                  label={`${screenSharer.name} · screen`}
                  showScreen
                />
              ) : call.remote ? (
                <VideoTile participant={call.remote} variant="stage" label={call.remote.name} />
              ) : (
                <WaitingRoom
                  title="You’re in the room"
                  message="Everything on your side is working."
                  waitingFor={otherPartyName}
                />
              )}

              {/* Local self-view. When someone is screen sharing, the remote
                  camera moves alongside it so faces are never lost. */}
              <div className="v-pips">
                {screenSharer && call.remote ? (
                  <VideoTile participant={call.remote} variant="pip" label={call.remote.name} />
                ) : null}
                <VideoTile participant={call.local} variant="pip" label={`${displayName} (you)`} />
              </div>
            </div>
          ) : null}

          {/* A recoverable error while live shows as a banner, not a takeover. */}
          {call.phase === 'live' && call.error?.recoverable ? (
            <div className="v-banner" role="status">
              {call.error.message}
            </div>
          ) : null}
        </section>

        {chatOpen ? (
          <ChatPanel
            messages={chat.messages}
            loading={chat.loading}
            error={chat.error}
            sending={chat.sending}
            sendError={chat.sendError}
            currentUserId={user?.uid ?? ''}
            onSend={(text) => void chat.send(text)}
            onClose={() => setChatOpen(false)}
          />
        ) : null}
      </div>

      {live ? (
        <footer className="v-foot">
          <CallControls
            micOn={call.micOn}
            cameraOn={call.cameraOn}
            screenOn={call.screenOn}
            canScreenShare={isDoctorSide}
            chatOpen={chatOpen}
            unreadCount={unreadCount}
            onToggleMic={call.toggleMic}
            onToggleCamera={call.toggleCamera}
            onToggleScreenShare={call.toggleScreenShare}
            onToggleChat={() => setChatOpen((o) => !o)}
            onEnd={() => void handleEnd()}
            endLabel={isDoctorSide ? 'End consultation' : 'Leave'}
            busy={ending}
          />
        </footer>
      ) : null}
    </main>
  );
}
