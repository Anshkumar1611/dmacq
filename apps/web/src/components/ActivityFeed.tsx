import type { Activity, CreateActivityInput } from "@dmacq/types";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { createActivity, fetchActivitiesPage } from "../api.js";

type LoadStatus = "idle" | "loading" | "loadingMore" | "error";

const PAGE_SIZE = 20;
const MOCK_REALTIME_MS = 12000;

const mockRealtimeEnabled = import.meta.env.VITE_ENABLE_MOCK_REALTIME === "true";

function initialsFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function IconBase({ children, ...rest }: SVGProps<SVGSVGElement> & { children?: ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

function TypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const stroke = "currentColor";
  const sw = 2;
  switch (t) {
    case "comment":
      return (
        <IconBase>
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </IconBase>
      );
    case "create":
      return (
        <IconBase>
          <path
            d="M12 5v14M5 12h14"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </IconBase>
      );
    case "update":
      return (
        <IconBase>
          <path
            d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </IconBase>
      );
    case "assign":
      return (
        <IconBase>
          <path
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 2-2 2-2-2m2 2V9"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </IconBase>
      );
    case "heartbeat":
      return (
        <IconBase>
          <path
            d="M22 12h-4l-3 9L9 3l-3 9H2"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </IconBase>
      );
    default:
      return (
        <IconBase>
          <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} />
          <path d="M12 8v5l3 2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </IconBase>
      );
  }
}

const ActivityRow = memo(function ActivityRow({ item }: { item: Activity }) {
  const optimistic = Boolean(item.metadata && item.metadata._optimistic === true);
  return (
    <li
      className={`feed-item${optimistic ? " feed-item--optimistic" : ""}`}
      data-testid="activity-row"
      data-activity-id={item._id}
    >
      <div className="feed-item__avatar" aria-hidden>
        {initialsFromName(item.actorName)}
      </div>
      <div className="feed-item__body">
        <div className="feed-item__row-top">
          <span className="feed-item__name">{item.actorName}</span>
          <span className="feed-item__type-chip" data-type={item.type}>
            <TypeIcon type={item.type} />
            {item.type}
          </span>
        </div>
        {optimistic ? (
          <span className="feed-item__saving" data-testid="optimistic-badge">
            Saving…
          </span>
        ) : null}
        <div className="feed-item__meta">
          <span className="feed-item__meta-label">Entity</span>
          <code className="feed-item__entity-id">{item.entityId}</code>
        </div>
        <time className="feed-item__time" dateTime={item.createdAt}>
          {new Date(item.createdAt).toLocaleString()}
        </time>
      </div>
    </li>
  );
});

export function ActivityFeed({ tenantId }: { tenantId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [filterType, setFilterType] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
  const loadGuard = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    setFormError(null);
    try {
      const page = await fetchActivitiesPage(tenantId, null, PAGE_SIZE);
      setActivities(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [tenantId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadGuard.current) return;
    loadGuard.current = true;
    setStatus((s) => (s === "loading" ? s : "loadingMore"));
    try {
      const page = await fetchActivitiesPage(tenantId, nextCursor, PAGE_SIZE);
      setActivities((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      loadGuard.current = false;
    }
  }, [tenantId, hasMore, nextCursor]);

  useEffect(() => {
    if (!sentinelEl) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadMore();
      },
      { root: null, rootMargin: "200px", threshold: 0 },
    );
    obs.observe(sentinelEl);
    return () => obs.disconnect();
  }, [sentinelEl, loadMore]);

  useEffect(() => {
    if (!mockRealtimeEnabled) return;
    const id = window.setInterval(() => {
      const synthetic: Activity = {
        _id: `mock-${Date.now()}`,
        tenantId,
        actorId: "system",
        actorName: "System",
        type: "heartbeat",
        entityId: "feed",
        metadata: { mockRealtime: true },
        createdAt: new Date().toISOString(),
      };
      setActivities((prev) => [synthetic, ...prev]);
    }, MOCK_REALTIME_MS);
    return () => window.clearInterval(id);
  }, [tenantId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const submitActivity = useCallback(
    async (input: CreateActivityInput) => {
      setFormError(null);
      const tempId = `temp-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
      const optimistic: Activity = {
        _id: tempId,
        tenantId,
        actorId: input.actorId,
        actorName: input.actorName,
        type: input.type,
        entityId: input.entityId,
        metadata: { _optimistic: true, ...(input.metadata ?? {}) },
        createdAt: new Date().toISOString(),
      };
      setActivities((prev) => [optimistic, ...prev]);
      try {
        const saved = await createActivity(tenantId, input);
        setActivities((prev) => prev.map((a) => (a._id === tempId ? saved : a)));
        setToast("Activity saved");
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
          toastTimerRef.current = null;
          setToast(null);
        }, 2500);
      } catch {
        setActivities((prev) => prev.filter((a) => a._id !== tempId));
        setFormError("Could not create activity. Changes were rolled back.");
      }
    },
    [tenantId],
  );

  const onSubmitForm = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const actorId = String(fd.get("actorId") ?? "").trim();
      const actorName = String(fd.get("actorName") ?? "").trim();
      const type = String(fd.get("type") ?? "").trim();
      const entityId = String(fd.get("entityId") ?? "").trim();
      if (!actorId || !actorName || !type || !entityId) {
        setFormError("All fields are required.");
        return;
      }
      void submitActivity({ actorId, actorName, type, entityId });
      e.currentTarget.reset();
    },
    [submitActivity],
  );

  const visible =
    filterType === "" ? activities : activities.filter((a) => a.type === filterType);

  if (status === "loading" && activities.length === 0) {
    return (
      <div className="feed-page">
        <div className="feed-loading" data-testid="loading-state">
          Loading activity feed…
        </div>
      </div>
    );
  }

  if (status === "error" && activities.length === 0) {
    return (
      <div className="feed-page">
        <div className="feed-empty" data-testid="empty-error">
          <p style={{ marginTop: 0 }}>Could not load activities.</p>
          <button type="button" className="btn-ghost" onClick={() => void loadInitial()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-page">
      {mockRealtimeEnabled ? (
        <div className="feed-banner" role="status">
          <div>
            <strong>Mock real-time enabled</strong>
            Synthetic “heartbeat” rows are added in the browser only (not saved). Set{" "}
            <code>VITE_ENABLE_MOCK_REALTIME</code> to off in <code>.env</code> to disable.
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="feed-toast" data-testid="toast">
          {toast}
        </div>
      ) : null}

      <section className="feed-card">
        <p className="feed-card__eyebrow">Compose</p>
        <h2>New activity</h2>
        <form data-testid="create-form" onSubmit={onSubmitForm}>
          <div className="feed-form__grid">
            <label className="feed-field">
              <span className="feed-field__label">Actor ID</span>
              <input name="actorId" required autoComplete="off" />
            </label>
            <label className="feed-field">
              <span className="feed-field__label">Actor name</span>
              <input name="actorName" required autoComplete="name" />
            </label>
            <label className="feed-field">
              <span className="feed-field__label">Type</span>
              <select name="type" required defaultValue="comment">
                <option value="comment">comment</option>
                <option value="create">create</option>
                <option value="update">update</option>
                <option value="assign">assign</option>
              </select>
            </label>
            <label className="feed-field">
              <span className="feed-field__label">Entity ID</span>
              <input name="entityId" required autoComplete="off" />
            </label>
          </div>
          {formError ? (
            <p className="feed-error" data-testid="form-error">
              {formError}
            </p>
          ) : null}
          <button type="submit" className="btn-primary">
            Create (optimistic)
          </button>
        </form>
      </section>

      <div className="feed-stream-head">
        <h3>Activity stream</h3>
        <div className="feed-toolbar">
          <label>
            Filter
            <select
              data-testid="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter by activity type"
            >
              <option value="">All types</option>
              <option value="comment">comment</option>
              <option value="create">create</option>
              <option value="update">update</option>
              <option value="assign">assign</option>
              {mockRealtimeEnabled ? <option value="heartbeat">heartbeat (mock)</option> : null}
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="feed-empty" data-testid="empty-state">
          No activities match this filter.
        </div>
      ) : (
        <ul className="feed-list" data-testid="activity-list">
          {visible.map((item) => (
            <ActivityRow key={item._id} item={item} />
          ))}
        </ul>
      )}

      <div
        ref={setSentinelEl}
        className="feed-sentinel"
        data-testid="scroll-sentinel"
        aria-hidden
      />

      {status === "loadingMore" ? (
        <p className="feed-loading-more" data-testid="loading-more">
          Loading more…
        </p>
      ) : null}

      {hasMore && nextCursor ? (
        <p className="feed-hint">Scroll for older items</p>
      ) : null}
    </div>
  );
}
