import { useCallback, useState, type ChangeEvent } from "react";
import { ActivityFeed } from "./components/ActivityFeed.js";

export function App() {
  const [tenantId, setTenantId] = useState("demo-tenant");

  const onTenantChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTenantId(e.target.value);
  }, []);

  return (
    <div>
      <header className="app-header">
        <div className="app-header__brand">
          <h1 className="app-header__title">Activity feed</h1>
          <p className="app-header__subtitle">Tenant-scoped stream · cursor pagination</p>
        </div>
        <label className="app-header__tenant">
          Tenant
          <input
            data-testid="tenant-input"
            value={tenantId}
            onChange={onTenantChange}
            placeholder="e.g. demo-tenant"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </header>
      <main className="app-main">
        <ActivityFeed tenantId={tenantId} key={tenantId} />
      </main>
    </div>
  );
}
