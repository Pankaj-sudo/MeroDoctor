import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useConversations } from '../../hooks/useConversations';
import { ConversationListItem } from './ConversationListItem';
import { MessageThread } from './MessageThread';
import { Spinner } from '../Spinner';
import '../../styles/messaging.css';

// ============================================================================
// Patient messaging surface. A floating button (with unread badge) opens a
// slide-over panel: desktop/tablet a right-docked drawer, mobile full screen.
// The panel lists the patient's conversations; picking one opens the thread.
// A single conversation opens straight into its thread.
// ============================================================================

export function PatientMessagesPanel() {
  const { user } = useAuth();
  const { conversations, loading, totalUnread } = useConversations();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-select when there's exactly one conversation (the common case).
  useEffect(() => {
    if (open && !activeId && conversations.length === 1) setActiveId(conversations[0].id);
  }, [open, activeId, conversations]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeId && conversations.length > 1) setActiveId(null);
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeId, conversations.length]);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        className="pm-fab"
        onClick={() => setOpen(true)}
        aria-label={`Messages${totalUnread ? `, ${totalUnread} unread` : ''}`}
      >
        💬
        {totalUnread > 0 ? (
          <span className="pm-fab__badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="pm-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Messages">
          <div className="pm-panel" onClick={(e) => e.stopPropagation()}>
            {activeId ? (
              <div className="pm-body">
                <MessageThread
                  conversationId={activeId}
                  compact
                  onBack={conversations.length > 1 ? () => setActiveId(null) : undefined}
                />
              </div>
            ) : (
              <>
                <header className="pm-head">
                  <h2 className="pm-head__title">Messages</h2>
                  <button type="button" className="pm-head__close" onClick={() => setOpen(false)} aria-label="Close messages">
                    ✕
                  </button>
                </header>
                <div className="pm-list">
                  {loading ? (
                    <div className="pm-empty">
                      <Spinner size={20} />
                    </div>
                  ) : conversations.length === 0 ? (
                    <p className="pm-empty">
                      You don’t have any conversations yet. Once a doctor approves your
                      consultation, you can message them here.
                    </p>
                  ) : (
                    conversations.map((c) => (
                      <ConversationListItem
                        key={c.id}
                        conversation={c}
                        viewerUid={user.uid}
                        active={false}
                        showPatientName={false}
                        onSelect={() => setActiveId(c.id)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
