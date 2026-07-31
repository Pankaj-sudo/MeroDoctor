import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useConversations, filterConversations } from '../../hooks/useConversations';
import { ConversationListItem } from '../../components/messaging/ConversationListItem';
import { MessageThread } from '../../components/messaging/MessageThread';
import { Spinner } from '../../components/Spinner';
import type { ConversationFilter } from '../../types/messaging';
import '../../styles/messaging.css';

// ============================================================================
// Doctor messaging center — a two-column layout: a searchable, filterable
// conversation list on the left and the selected thread on the right. On mobile
// it collapses to one column (list ↔ thread). The selected conversation id is
// carried in the URL (/doctor/messages/:id) so it's linkable and refresh-safe.
// ============================================================================

const FILTERS: { id: ConversationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'follow_up', label: 'Follow-up' },
];

export function MessagingCenter() {
  const { id: activeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { conversations, loading, totalUnread } = useConversations();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');

  const visible = useMemo(
    () => filterConversations(conversations, filter, search),
    [conversations, filter, search],
  );

  const select = (cid: string) => navigate(`/doctor/messages/${cid}`);

  return (
    <div className="mc-shell">
      <aside className={`mc-list ${activeId ? 'is-hidden' : ''}`}>
        <div className="mc-list__head">
          <h1 className="mc-list__title">
            <button type="button" className="mc-list__back" onClick={() => navigate('/doctor')}>
              ‹ Dashboard
            </button>
            Messages
            {totalUnread > 0 ? <span className="m-conv__badge">{totalUnread}</span> : null}
          </h1>
          <input
            className="mc-search"
            type="search"
            placeholder="Search patients or messages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search conversations"
          />
          <div className="mc-filters" role="tablist" aria-label="Filter conversations">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`mc-filter ${filter === f.id ? 'is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mc-scroll">
          {loading ? (
            <div className="mc-empty">
              <Spinner size={20} />
            </div>
          ) : visible.length === 0 ? (
            <p className="mc-empty">
              {conversations.length === 0
                ? 'No conversations yet. Approve a consultation to start one.'
                : 'No conversations match this filter.'}
            </p>
          ) : (
            visible.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                viewerUid={user?.uid ?? ''}
                active={c.id === activeId}
                showPatientName
                onSelect={() => select(c.id)}
              />
            ))
          )}
        </div>
      </aside>

      <div className={`mc-detail ${activeId ? '' : 'is-hidden'}`}>
        {activeId ? (
          <MessageThread
            key={activeId}
            conversationId={activeId}
            onBack={() => navigate('/doctor/messages')}
          />
        ) : (
          <div className="mc-placeholder">
            <span className="mc-placeholder__glyph" aria-hidden="true">
              💬
            </span>
            <p>Select a conversation to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
