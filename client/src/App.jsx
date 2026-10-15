
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

// API configuration: set VITE_API_URL in Vercel to your deployed backend URL.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const CATEGORIES = [
'Royalty & Payments',
'ISBN & Metadata Issues',
'Printing & Quality',
'Distribution & Availability',
'Book Status & Production Updates',
'General Inquiry',
];

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const PRIORITY_ORDER = {
Critical: 0,
High: 1,
Medium: 2,
Low: 3,
};

function money(amount) {
return new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));
}

function date(value) {
return value
  ? new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  : '—';
}

function App() {
// Authentication and navigation
const [session, setSession] = useState(() => {
  try {
    return JSON.parse(
      localStorage.getItem('bookleaf-session') || 'null'
    );
  } catch {
    return null;
  }
});

const [page, setPage] = useState('overview');

// Application data
const [books, setBooks] = useState([]);
const [tickets, setTickets] = useState([]);
const [selected, setSelected] = useState(null);

// Loading, errors, and notifications
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [notice, setNotice] = useState('');
const [loginBusy, setLoginBusy] = useState(false);
const [detailLoading, setDetailLoading] = useState(false);

// Search and filters
const [query, setQuery] = useState('');
const [statusFilter, setStatusFilter] = useState('All');
const [categoryFilter, setCategoryFilter] = useState('All');
const [priorityFilter, setPriorityFilter] = useState('All');
const [fromDate, setFromDate] = useState('');
const [toDate, setToDate] = useState('');

// Login form
const [loginEmail, setLoginEmail] = useState('');
const [loginPassword, setLoginPassword] = useState('');

// Support ticket form
const [formOpen, setFormOpen] = useState(false);
const [subject, setSubject] = useState('');
const [description, setDescription] = useState('');
const [bookId, setBookId] = useState('general');
const [attachmentName, setAttachmentName] = useState('');

// Ticket replies and internal notes
const [draft, setDraft] = useState('');
const [reply, setReply] = useState('');
const [note, setNote] = useState('');

const admin = session?.user?.role === 'admin';

// API request helper
const request = useCallback(
  async (path, options = {}) => {
    if (!API) {
      throw new Error(
        'API URL is not configured. Set VITE_API_URL in Vercel and redeploy.'
      );
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token
          ? { Authorization: `Bearer ${session.token}` }
          : {}),
        ...(options.headers || {}),
      },
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      // Handle responses without JSON bodies.
    }

    if (!response.ok) {
      throw new Error(
        data.error || 'Request failed. Please try again.'
      );
    }

    return data;
  },
  [session]
);

// Load books and tickets
const load = useCallback(
  async (silent = false) => {
    if (!session) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      const [bookData, ticketData] = await Promise.all([
        request('/books'),
        request('/tickets'),
      ]);

      setBooks(bookData);
      setTickets(ticketData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  },
  [session, request]
);

// Initial data loading and automatic refresh
useEffect(() => {
  load();
}, [load]);

useEffect(() => {
  if (!session) return;

  const interval = setInterval(() => {
    load(true);
  }, 5000);

  return () => clearInterval(interval);
}, [session, load]);

// Automatically refresh the selected ticket
useEffect(() => {
  if (!session || !selected?._id) return;

  const interval = setInterval(async () => {
    try {
      const freshTicket = await request(
        `/tickets/${selected._id}`
      );

      setSelected(freshTicket);
    } catch {
      // Keep the currently displayed ticket.
    }
  }, 5000);

  return () => clearInterval(interval);
}, [session, selected?._id, request]);

// Sign in
async function login(event) {
  event.preventDefault();

  setLoginBusy(true);
  setError('');

  try {
    if (!API) {
      throw new Error(
        'API URL is not configured. Set VITE_API_URL in Vercel and redeploy.'
      );
    }

    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
    });

    let result = {};

    try {
      result = await response.json();
    } catch {
      throw new Error('The server returned an invalid response.');
    }

    if (!response.ok) {
      throw new Error(result.error || 'Login failed');
    }

    localStorage.setItem(
      'bookleaf-session',
      JSON.stringify(result)
    );

    setSession(result);
    setPage('overview');

    setNotice(
      `Welcome back, ${result.user.name.split(' ')[0]}.`
    );
  } catch (err) {
    setError(err.message || 'Unable to sign in. Please try again.');
  } finally {
    setLoginBusy(false);
  }
}

// Sign out
function logout() {
  localStorage.removeItem('bookleaf-session');

  setSession(null);
  setSelected(null);
  setBooks([]);
  setTickets([]);
}

// Open a ticket and load its latest details
async function openTicket(ticket) {
  setSelected(ticket);
  setDraft('');
  setReply('');
  setNote('');
  setDetailLoading(true);

  try {
    const freshTicket = await request(
      `/tickets/${ticket._id}`
    );

    setSelected(freshTicket);
  } catch (err) {
    setError(err.message);
  } finally {
    setDetailLoading(false);
  }
}

// Create a new support ticket
async function createTicket(event) {
  event.preventDefault();
  setError('');

  try {
    const ticket = await request('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        bookId,
        subject,
        description,
        attachmentName,
      }),
    });

    setTickets((previous) => [ticket, ...previous]);

    setFormOpen(false);
    setSubject('');
    setDescription('');
    setAttachmentName('');

    setNotice('Your ticket has been submitted.');
    setPage('tickets');
  } catch (err) {
    setError(err.message);
  }
}

// Update ticket details
async function updateTicket(patch) {
  if (!selected) return;

  try {
    const ticket = await request(
      `/tickets/${selected._id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    );

    setSelected({
      ...selected,
      ...ticket,
    });

    setTickets((previous) =>
      previous.map((item) =>
        item._id === ticket._id
          ? { ...item, ...ticket }
          : item
      )
    );

    setNotice('Ticket updated.');
  } catch (err) {
    setError(err.message);
  }
}

// Generate an AI-assisted reply
async function makeDraft() {
  if (!selected) return;

  setDetailLoading(true);
  setError('');

  try {
    const result = await request(
      `/tickets/${selected._id}/ai-draft`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    setDraft(result.draft);
    setReply(result.draft);
  } catch (err) {
    setError(err.message);
  } finally {
    setDetailLoading(false);
  }
}

// Send a response to the author
async function sendReply(event) {
  event.preventDefault();

  if (!reply.trim()) return;

  try {
    const ticket = await request(
      `/tickets/${selected._id}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          body: reply,
        }),
      }
    );

    setSelected(ticket);

    setTickets((previous) =>
      previous.map((item) =>
        item._id === ticket._id ? ticket : item
      )
    );

    setReply('');
    setNotice('Response sent to the author.');
  } catch (err) {
    setError(err.message);
  }
}

// Add an internal note
async function addNote(event) {
  event.preventDefault();

  if (!note.trim()) return;

  try {
    await request(`/tickets/${selected._id}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: note,
      }),
    });

    setNote('');
    setNotice('Internal note saved.');
  } catch (err) {
    setError(err.message);
  }
}

// Filter tickets
const filtered = useMemo(
  () =>
    tickets.filter((ticket) => {
      const searchableText = `
        ${ticket.subject}
        ${ticket.description}
        ${ticket.bookTitle || ''}
        ${ticket.author?.name || ''}
      `.toLowerCase();

      return (
        searchableText.includes(query.toLowerCase()) &&
        (statusFilter === 'All' ||
          ticket.status === statusFilter) &&
        (categoryFilter === 'All' ||
          ticket.category === categoryFilter) &&
        (priorityFilter === 'All' ||
          ticket.priority === priorityFilter) &&
        (!fromDate ||
          new Date(ticket.createdAt) >=
            new Date(`${fromDate}T00:00:00`)) &&
        (!toDate ||
          new Date(ticket.createdAt) <=
            new Date(`${toDate}T23:59:59`))
      );
    }),
  [
    tickets,
    query,
    statusFilter,
    categoryFilter,
    priorityFilter,
    fromDate,
    toDate,
  ]
);

// Dashboard statistics
const stats = useMemo(
  () => ({
    open: tickets.filter((ticket) =>
      ['Open', 'In Progress'].includes(ticket.status)
    ).length,

    high: tickets.filter(
      (ticket) =>
        ['Critical', 'High'].includes(ticket.priority) &&
        !['Resolved', 'Closed'].includes(ticket.status)
    ).length,

    resolved: tickets.filter(
      (ticket) => ticket.status === 'Resolved'
    ).length,

    pending: books.reduce(
      (total, book) =>
        total + Number(book.royaltyPending || 0),
      0
    ),
  }),
  [tickets, books]
);

// Keep your existing JSX for the login page, dashboard,
// books table, ticket list, ticket drawer, and ticket modal
// below this point unchanged.

return (
  <div className="login-shell">
    <div className="login-art">
      <div className="brand brand-light">
        <span className="brand-mark">
          <BookOpen size={22} />
        </span>
        <span>
          bookleaf<span className="brand-dot">.</span>
        </span>
      </div>

      <div className="login-copy">
            <div className="eyebrow">
              AUTHOR CARE, REIMAGINED
            </div>

        <h1>
          Every story deserves
          <br />
          a little support.
        </h1>

        <p>
              A simpler way to keep track of your books,
              royalties, and conversations with the BookLeaf team.
        </p>

            <div className="login-mini-stats">
              <div>
                <strong>22k+</strong>
                <span>titles supported</span>
              </div>

              <div>
                <strong>1.2k+</strong>
                <span>books each month</span>
              </div>
            </div>
          </div>

          <div className="login-footer">
            Publishing together, one page at a time.
      </div>
    </div>

    <div className="login-panel">
      <form className="login-form" onSubmit={login}>
            <div className="mobile-brand brand">
              <span className="brand-mark">
                <BookOpen size={22} />
              </span>

              <span>
                bookleaf<span className="brand-dot">.</span>
              </span>
            </div>

        <div className="eyebrow">WELCOME BACK</div>

        <h2>Sign in to your portal</h2>

        <p className="muted">
          Use your BookLeaf account to continue.
        </p>

            {error && (
              <div className="alert error">
                {error}
              </div>
            )}

        <label>Email address</label>

        <input
          type="email"
          value={loginEmail}
              onChange={(event) =>
                setLoginEmail(event.target.value)
              }
          placeholder="you@example.com"
          required
        />

        <label>Password</label>

        <input
          type="password"
          value={loginPassword}
          onChange={(event) =>
            setLoginPassword(event.target.value)
          }
          placeholder="Enter your password"
          required
        />

        <button
          className="btn primary full"
          type="submit"
          disabled={loginBusy}
        >
          {loginBusy ? 'Signing in…' : 'Sign in'}
          <ChevronRight size={17} />
        </button>

        <div className="login-secure">
          <ShieldCheck size={15} />
          Secure access to your publishing account
        </div>
      </form>
    </div>
  </div>
);
}

  // Authenticated application
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={21} />
          </span>

          <span>
            bookleaf<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <button
          className={`nav-item ${
            page === 'overview' ? 'active' : ''
          }`}
          onClick={() => {
            setPage('overview');
            setSelected(null);
          }}
        >
          <LayoutDashboard size={18} />
          Overview
        </button>

        <button
          className={`nav-item ${
            page === 'books' ? 'active' : ''
          }`}
          onClick={() => {
            setPage('books');
            setSelected(null);
          }}
        >
          <BookOpen size={18} />
          {admin ? 'All books' : 'My books'}
          <span className="nav-count">{books.length}</span>
        </button>

        <button
          className={`nav-item ${
            page === 'tickets' ? 'active' : ''
          }`}
          onClick={() => {
            setPage('tickets');
            setSelected(null);
          }}
        >
          <LifeBuoy size={18} />
          {admin ? 'Ticket queue' : 'My tickets'}
          <span className="nav-count">{tickets.length}</span>
        </button>

        {!admin && (
          <button
            className="nav-item"
            onClick={() => setFormOpen(true)}
          >
            <Plus size={18} />
            New support ticket
          </button>
        )}

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <MessageSquare size={18} />
            </div>

            <strong>Need a hand?</strong>

            <p>
              Our support team is here to help with your
              publishing journey.
            </p>

            <button
              onClick={() => {
                setFormOpen(true);
                setPage('tickets');
              }}
            >
              Contact support
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="profile">
            <div className="avatar">
              {session.user.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </div>

            <div className="profile-info">
              <strong>{session.user.name}</strong>
              <span>
                {admin ? 'Operations admin' : 'Author account'}
              </span>
            </div>

            <button
              className="icon-btn"
              title="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            Workspace
            <ChevronRight size={14} />
            <strong>
              {page === 'overview'
                ? 'Overview'
                : page === 'books'
                  ? admin
                    ? 'All books'
                    : 'My books'
                  : admin
                    ? 'Ticket queue'
                    : 'My tickets'}
            </strong>
          </div>

          <div className="topbar-right">
            <span className="live-indicator">
              <span />
              Live updates on
            </span>

            <div className="avatar small">
              {session.user.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </div>
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="alert error">
              <AlertTriangle size={16} />
              {error}

              <button onClick={() => setError('')}>
                <X size={15} />
              </button>
            </div>
          )}

          {notice && (
            <div className="alert success">
              <CheckCircle2 size={16} />
              {notice}

              <button onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}

          {/* Overview */}
          {page === 'overview' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    YOUR PUBLISHING WORKSPACE
                  </div>

                  <h1>
                    {admin
                      ? 'Good to see you, team.'
                      : `Welcome back, ${
                          session.user.name.split(' ')[0]
                        }.`}
                  </h1>

                  <p>
                    {admin
                      ? 'Here’s what needs your team’s attention today.'
                      : 'Here’s an overview of your books and support conversations.'}
                  </p>
                </div>

                {!admin && (
                  <button
                    className="btn primary"
                    onClick={() => setFormOpen(true)}
                  >
                    <Plus size={17} />
                    Raise a ticket
                  </button>
                )}
              </div>

              <div className="stats-grid">
                <Stat
                  icon={<LifeBuoy size={18} />}
                  label={
                    admin ? 'Active tickets' : 'My active tickets'
                  }
                  value={stats.open}
                  sub="Open or in progress"
                  tone="blue"
                />

                <Stat
                  icon={<AlertTriangle size={18} />}
                  label="High priority"
                  value={stats.high}
                  sub="Needs attention"
                  tone="amber"
                />

                <Stat
                  icon={<CheckCircle2 size={18} />}
                  label="Resolved tickets"
                  value={stats.resolved}
                  sub="Successfully resolved"
                  tone="green"
                />

                <Stat
                  icon={<BookOpen size={18} />}
                  label={
                    admin ? 'Books in catalogue' : 'Royalty pending'
                  }
                  value={
                    admin ? books.length : money(stats.pending)
                  }
                  sub={
                    admin
                      ? 'Across author accounts'
                      : 'Awaiting payout'
                  }
                  tone="purple"
                />
              </div>

              <div className="dashboard-grid">
                <section className="panel ticket-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>
                        {admin
                          ? 'Priority ticket queue'
                          : 'Recent support tickets'}
                      </h3>

                      <p>
                        {admin
                          ? 'Oldest and most urgent items first'
                          : 'Your latest conversations with BookLeaf'}
                      </p>
                    </div>

                    <button
                      className="text-btn"
                      onClick={() => setPage('tickets')}
                    >
                      View all
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  {tickets.length === 0 ? (
                    <Empty
                      icon={<LifeBuoy />}
                      title="No tickets yet"
                      text="Your support conversations will appear here."
                    />
                  ) : (
                    <div className="ticket-list">
                      {[...tickets]
                        .sort(
                          (a, b) =>
                            (PRIORITY_ORDER[a.priority] ?? 2) -
                            (PRIORITY_ORDER[b.priority] ?? 2)
                        )
                        .slice(0, 5)
                        .map((ticket) => (
                          <TicketRow
                            key={ticket._id}
                            ticket={ticket}
                            admin={admin}
                            onClick={() => openTicket(ticket)}
                          />
                        ))}
                    </div>
                  )}
                </section>

                <section className="panel books-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>
                        {admin
                          ? 'Recently updated books'
                          : 'My books'}
                      </h3>

                      <p>
                        {admin
                          ? 'Across the author catalogue'
                          : 'Your publishing catalogue'}
                      </p>
                    </div>

                    <button
                      className="text-btn"
                      onClick={() => setPage('books')}
                    >
                      View all
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  {books.slice(0, 5).map((book) => (
                    <div className="book-mini" key={book._id}>
                      <div className="book-cover">
                        <BookOpen size={20} />
                      </div>

                      <div className="book-mini-info">
                        <strong>{book.title}</strong>
                        <span>
                          {book.genre || 'Book'} · {book.status}
                        </span>
                      </div>

                      <span
                        className={`status-pill ${
                          book.status === 'Published & Live'
                            ? 'resolved'
                            : 'progress'
                        }`}
                      >
                        {book.status === 'Published & Live'
                          ? 'Published'
                          : 'In production'}
                      </span>
                    </div>
                  ))}
                </section>
              </div>

              <div className="tip-banner">
                <div className="tip-icon">
                  <Sparkles size={20} />
                </div>

                <div>
                  <strong>
                    Need help with a royalty or production question?
                  </strong>

                  <p>
                    Submit a ticket and the BookLeaf team will
                    route it to the right specialist.
                  </p>
                </div>

                {!admin && (
                  <button
                    className="btn outline"
                    onClick={() => setFormOpen(true)}
                  >
                    Get support
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </>
          )}

          {/* Books */}
          {page === 'books' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CATALOGUE</div>

                  <h1>{admin ? 'All books' : 'My books'}</h1>

                  <p>
                    {admin
                      ? 'Review book status and royalty summaries across authors.'
                      : 'Your published titles, sales, and royalty information in one place.'}
                  </p>
                </div>

                <button
                  className="btn outline"
                  onClick={() => load()}
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              <div className="panel table-panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={17} />

                    <input
                      value={query}
                      onChange={(event) =>
                        setQuery(event.target.value)
                      }
                      placeholder="Search books…"
                    />
                  </div>

                  <span className="muted small-text">
                    {
                      books.filter((book) =>
                        `${book.title} ${book.isbn || ''}`
                          .toLowerCase()
                          .includes(query.toLowerCase())
                      ).length
                    }{' '}
                    titles
                  </span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>BOOK TITLE</th>
                        {admin && <th>AUTHOR</th>}
                        <th>ISBN</th>
                        <th>STATUS</th>
                        <th>MRP</th>
                        <th>SOLD</th>
                        <th>ROYALTY EARNED</th>
                        <th>PAID</th>
                        <th>PENDING</th>
                      </tr>
                    </thead>

                    <tbody>
                      {books
                        .filter((book) =>
                          `${book.title} ${book.isbn || ''}`
                            .toLowerCase()
                            .includes(query.toLowerCase())
                        )
                        .map((book) => (
                          <tr key={book._id}>
                            <td>
                              <div className="table-book">
                                <div className="book-cover tiny">
                                  <BookOpen size={15} />
                                </div>

                                <div>
                                  <strong>{book.title}</strong>
                                  <span>{book.genre || '—'}</span>
                                </div>
                              </div>
                            </td>

                            {admin && (
                              <td>
                                {book.author?.name || '—'}
                              </td>
                            )}

                            <td className="mono">
                              {book.isbn || 'Pending'}
                            </td>

                            <td>
                              <span
                                className={`status-pill ${
                                  book.status === 'Published & Live'
                                    ? 'resolved'
                                    : 'progress'
                                }`}
                              >
                                {book.status}
                              </span>
                            </td>

                            <td>{money(book.mrp)}</td>
                            <td>{book.copiesSold || 0}</td>
                            <td>{money(book.royaltyEarned)}</td>
                            <td>{money(book.royaltyPaid)}</td>

                            <td className="pending-cell">
                              {money(book.royaltyPending)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {!books.length && (
                    <Empty
                      icon={<BookOpen />}
                      title="No books found"
                      text="Books linked to your account will appear here."
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Support tickets */}
          {page === 'tickets' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">SUPPORT CENTRE</div>

                  <h1>
                    {admin ? 'Ticket queue' : 'My support tickets'}
                  </h1>

                  <p>
                    {admin
                      ? 'Triage incoming requests and keep author conversations moving.'
                      : 'Track requests, see replies, and stay up to date on every issue.'}
                  </p>
                </div>

                {!admin && (
                  <button
                    className="btn primary"
                    onClick={() => setFormOpen(true)}
                  >
                    <Plus size={17} />
                    New ticket
                  </button>
                )}
              </div>

              <div className="panel table-panel">
                <div className="filters">
                  <div className="search-box">
                    <Search size={17} />

                    <input
                      value={query}
                      onChange={(event) =>
                        setQuery(event.target.value)
                      }
                      placeholder="Search tickets…"
                    />
                  </div>

                  <div className="filter-select">
                    <SlidersHorizontal size={15} />

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value)
                      }
                    >
                      <option>All</option>

                      {STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  {admin && (
                    <>
                      <select
                        className="select-filter"
                        value={categoryFilter}
                        onChange={(event) =>
                          setCategoryFilter(event.target.value)
                        }
                      >
                        <option value="All">All categories</option>

                        {CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>

                      <select
                        className="select-filter"
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(event.target.value)
                        }
                      >
                        <option value="All">All priorities</option>

                        {PRIORITIES.map((priority) => (
                          <option key={priority}>{priority}</option>
                        ))}
                      </select>

                      <label className="date-filter">
                        From

                        <input
                          type="date"
                          value={fromDate}
                          onChange={(event) =>
                            setFromDate(event.target.value)
                          }
                        />
                      </label>

                      <label className="date-filter">
                        To

                        <input
                          type="date"
                          value={toDate}
                          onChange={(event) =>
                            setToDate(event.target.value)
                          }
                        />
                      </label>
                    </>
                  )}

                  <button
                    className="icon-btn bordered"
                    onClick={() => load()}
                    title="Refresh"
                    disabled={loading}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                <div className="ticket-table-list">
                  {filtered.map((ticket) => (
                    <TicketRow
                      key={ticket._id}
                      ticket={ticket}
                      admin={admin}
                      onClick={() => openTicket(ticket)}
                    />
                  ))}
                </div>

                {!filtered.length && (
                  <Empty
                    icon={<LifeBuoy />}
                    title="No matching tickets"
                    text="Try changing your filters, or submit a new support request."
                  />
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Ticket details drawer */}
      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <section
            className="ticket-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-top">
              <div>
                <div className="eyebrow">TICKET DETAILS</div>

                <span className="ticket-id">
                  BL-{String(selected._id).slice(-6).toUpperCase()}
                </span>
              </div>

              <button
                className="icon-btn"
                onClick={() => setSelected(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="drawer-body">
              {detailLoading && (
                <div className="inline-loading">
                  <RefreshCw size={15} />
                  Updating ticket…
                </div>
              )}

              <h2>{selected.subject}</h2>

              <div className="ticket-meta">
                <Priority priority={selected.priority} />

                <span
                  className={`status-pill ${
                    selected.status === 'Resolved'
                      ? 'resolved'
                      : selected.status === 'Closed'
                        ? 'closed'
                        : 'progress'
                  }`}
                >
                  {selected.status}
                </span>

                <span className="muted">
                  Created {date(selected.createdAt)}
                </span>
              </div>

              <div className="detail-facts">
                <div>
                  <span>AUTHOR</span>
                  <strong>
                    {selected.author?.name || session.user.name}
                  </strong>
                </div>

                <div>
                  <span>BOOK</span>
                  <strong>
                    {selected.bookTitle || 'General / Account Level'}
                  </strong>
                </div>

                <div>
                  <span>CATEGORY</span>
                  <strong>{selected.category}</strong>
                </div>

                <div>
                  <span>ASSIGNED TO</span>
                  <strong>{selected.assignedName || 'Unassigned'}</strong>
                </div>
              </div>

              <section className="conversation">
                <h4>Original query</h4>

                <div className="message author-message">
                  <div className="message-by">
                    <span className="avatar tiny-avatar">
                      {(selected.author?.name || session.user.name)
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </span>

                    <strong>
                      {selected.author?.name || session.user.name}
                    </strong>

                    <span>{date(selected.createdAt)}</span>
                  </div>

                  <p>{selected.description}</p>

                  {selected.attachmentName && (
                    <div className="attachment">
                      <Paperclip size={14} />
                      {selected.attachmentName}
                    </div>
                  )}
                </div>

                {(selected.messages || []).map((message, index) => (
                  <div
                    className="message admin-message"
                    key={message._id || index}
                  >
                    <div className="message-by">
                      <span className="avatar tiny-avatar green-avatar">
                        {(message.senderName || 'BL')
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </span>

                      <strong>
                        {message.senderName || 'BookLeaf Support'}
                      </strong>

                      <span>{date(message.createdAt)}</span>
                    </div>

                    <p>{message.body}</p>
                  </div>
                ))}
              </section>

              {/* Admin ticket controls */}
              {admin ? (
                <>
                  <div className="admin-controls">
                    <h4>Manage ticket</h4>

                    <div className="control-grid">
                      <label>
                        Status

                        <select
                          value={selected.status}
                          onChange={(event) =>
                            updateTicket({
                              status: event.target.value,
                            })
                          }
                        >
                          {STATUSES.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Priority

                        <select
                          value={selected.priority}
                          onChange={(event) =>
                            updateTicket({
                              priority: event.target.value,
                            })
                          }
                        >
                          {PRIORITIES.map((priority) => (
                            <option key={priority}>{priority}</option>
                          ))}
                        </select>
                      </label>

                      <label className="wide-control">
                        Category

                        <select
                          value={selected.category}
                          onChange={(event) =>
                            updateTicket({
                              category: event.target.value,
                            })
                          }
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      className="btn outline full"
                      onClick={() =>
                        updateTicket({ assignedToMe: true })
                      }
                    >
                      <CircleUserRound size={16} />
                      Assign to me
                    </button>
                  </div>

                  <form
                    className="reply-section"
                    onSubmit={sendReply}
                  >
                    <div className="reply-heading">
                      <h4>Reply to author</h4>

                      <button
                        className="btn ai-btn"
                        type="button"
                        onClick={makeDraft}
                        disabled={detailLoading}
                      >
                        <Sparkles size={15} />

                        {detailLoading
                          ? 'Generating…'
                          : 'Draft with AI'}
                      </button>
                    </div>

                    <textarea
                      value={reply}
                      onChange={(event) =>
                        setReply(event.target.value)
                      }
                      rows="5"
                      placeholder="Write a helpful response…"
                      required
                    />

                    <p className="helper-text">
                      AI drafts are suggestions. Review facts and
                      edit before sending.
                    </p>

                    <button
                      className="btn primary full"
                      type="submit"
                    >
                      <Send size={15} />
                      Send response
                    </button>
                  </form>

                  <section className="note-form">
                    <h4>
                      Internal notes
                      <span>Only visible to your team</span>
                    </h4>

                    {(selected.internalNotes || []).map(
                      (internalNote, index) => (
                        <div
                          className="internal-note"
                          key={internalNote._id || index}
                        >
                          <strong>
                            {internalNote.authorName || 'Admin'} ·{' '}
                            {date(internalNote.createdAt)}
                          </strong>

                          <p>{internalNote.body}</p>
                        </div>
                      )
                    )}
                  </section>

                  <form
                    className="note-form"
                    onSubmit={addNote}
                  >
                    <h4>
                      Add internal note
                      <span>Only visible to your team</span>
                    </h4>

                    <textarea
                      value={note}
                      onChange={(event) =>
                        setNote(event.target.value)
                      }
                      rows="2"
                      placeholder="Add an internal note…"
                    />

                    <button
                      className="btn outline full"
                      type="submit"
                    >
                      Save internal note
                    </button>
                  </form>
                </>
              ) : (
                <div className="author-next-step">
                  <LifeBuoy size={19} />

                  <div>
                    <strong>We’re here to help</strong>

                    <p>
                      New responses appear here automatically.
                      This page checks for updates every 5 seconds.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* New support ticket modal */}
      {formOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setFormOpen(false)}
        >
          <section
            className="form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">SUPPORT CENTRE</div>

                <h2>Raise a support ticket</h2>

                <p>
                  Tell us what you need help with and we’ll route it
                  to the right team.
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setFormOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={createTicket}
              className="support-form"
            >
              <label>Which book is this about?</label>

              <select
                value={bookId}
                onChange={(event) => setBookId(event.target.value)}
              >
                <option value="general">
                  General / Account Level
                </option>

                {books.map((book) => (
                  <option value={book._id} key={book._id}>
                    {book.title}
                  </option>
                ))}
              </select>

              <label>Subject</label>

              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength="4"
                maxLength="180"
                placeholder="A short summary of your question"
                required
              />

              <label>Describe your query</label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows="5"
                minLength="10"
                maxLength="6000"
                placeholder="Share the details so we can help you faster…"
                required
              />

              <label>
                Attachment <span className="muted">(optional)</span>
              </label>

              <div className="attachment-input">
                <Paperclip size={17} />

                <input
                  type="file"
                  onChange={(event) =>
                    setAttachmentName(
                      event.target.files?.[0]?.name || ''
                    )
                  }
                />

                <span className="muted">
                  UI only; file content is not uploaded
                </span>
              </div>

              <div className="form-actions">
                <button
                  className="btn outline"
                  type="button"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </button>

                <button
                  className="btn primary"
                  type="submit"
                >
                  <Send size={15} />
                  Submit ticket
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );


// Reusable dashboard statistic
function Stat({ icon, label, value, sub, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// Reusable priority indicator
function Priority({ priority }) {
  const className = priority?.toLowerCase() || 'medium';

  return (
    <span className={`priority ${className}`}>
      <span />
      {priority || 'Medium'}
    </span>
  );
}

// Reusable support ticket row
function TicketRow({ ticket, admin, onClick }) {
  return (
    <button className="ticket-row" onClick={onClick}>
      <div className="ticket-row-main">
        <div className="ticket-subject">{ticket.subject}</div>

        <div className="ticket-description">
          {admin && ticket.author?.name
            ? `${ticket.author.name} · `
            : ''}
          {ticket.bookTitle || 'General / Account Level'} ·{' '}
          {date(ticket.createdAt)}
        </div>

        <div className="ticket-tags">
          <Priority priority={ticket.priority} />

          <span
            className={`status-pill ${
              ticket.status === 'Resolved'
                ? 'resolved'
                : ticket.status === 'Closed'
                  ? 'closed'
                  : 'progress'
            }`}
          >
            {ticket.status}
          </span>

          <span className="category-label">
            {ticket.category}
          </span>
        </div>
      </div>

      <ChevronRight className="row-chevron" size={18} />
    </button>
  );
}

// Reusable empty state
function Empty({ icon, title, text }) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default App;
