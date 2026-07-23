import { useMemo, useState } from "react";
import type { CreatureSize, CreatureSource, MiniFigEntry, MiniSize } from "../types";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface Props {
  entries: MiniFigEntry[];
  sources: CreatureSource[];
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
  onAddCreature: () => void;
  onManageSources: () => void;
  onRefreshSources: () => Promise<number>;
}

const CREATURE_SIZES: CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];
const MINI_SIZES: MiniSize[] = [24, 28, 32];

export function CreatureBinder({
  entries,
  sources,
  onUpdate,
  onRemove,
  onPreview,
  onAddCreature,
  onManageSources,
  onRefreshSources,
}: Props) {
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...entries]
      .filter((entry) => !normalized || entry.name.toLowerCase().includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, query]);
  const refreshAllSources = async () => {
    setRefreshing(true);
    setRefreshMessage("");
    try {
      const creatureCount = await onRefreshSources();
      setRefreshMessage(
        `Refreshed ${sources.length} source${sources.length === 1 ? "" : "s"} · ${creatureCount} creature${creatureCount === 1 ? "" : "s"}`,
      );
    } catch (caught) {
      setRefreshMessage(caught instanceof Error ? caught.message : "The sources could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
    <section className="binder-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">Creature library</span>
          <h2>Your binder</h2>
          <p>{entries.length} creature{entries.length === 1 ? "" : "s"} ready to reuse.</p>
        </div>
        <div className="binder-toolbar-actions">
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creatures…"
          />
          <div className="source-button-group">
            <button className="btn btn-secondary" onClick={onManageSources}>Sources</button>
            <button
              className="btn btn-secondary source-refresh-button"
              type="button"
              onClick={refreshAllSources}
              disabled={sources.length === 0 || refreshing}
              aria-label="Refresh all sources"
              title={sources.length === 0 ? "Add a source first" : "Refresh all sources"}
            >
              <span className={refreshing ? "refresh-icon spinning" : "refresh-icon"} aria-hidden="true">↻</span>
            </button>
          </div>
          <button className="btn btn-primary" onClick={onAddCreature}>+ Add creature</button>
        </div>
      </div>

      {refreshMessage && (
        <p className="source-refresh-message" role="status">{refreshMessage}</p>
      )}

      {visibleEntries.length > 0 ? (
        <div className="creature-grid">
          {visibleEntries.map((entry) => (
            <article className="creature-card" key={entry.id}>
              <CreatureThumbnail
                className="creature-art"
                entry={entry}
                showSelection
                onPreview={onPreview}
              />

              <div className="creature-card-body">
                <input
                  className="creature-name-input"
                  value={entry.name}
                  onChange={(event) => onUpdate(entry.id, { name: event.target.value })}
                  aria-label="Creature name"
                />
                <div className="creature-settings">
                  <label>
                    <span>Size</span>
                    <select
                      value={entry.creatureSize}
                      onChange={(event) => onUpdate(entry.id, { creatureSize: event.target.value as CreatureSize })}
                    >
                      {CREATURE_SIZES.map((size) => (
                        <option key={size} value={size}>{size[0].toUpperCase() + size.slice(1)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Scale</span>
                    <select
                      value={entry.miniSize}
                      onChange={(event) => onUpdate(entry.id, { miniSize: Number(event.target.value) as MiniSize })}
                    >
                      {MINI_SIZES.map((size) => <option key={size} value={size}>{size}mm</option>)}
                    </select>
                  </label>
                </div>
                <label className="card-toggle">
                  <input
                    type="checkbox"
                    checked={entry.showName}
                    onChange={(event) => onUpdate(entry.id, { showName: event.target.checked })}
                  />
                  Show name on base
                </label>
                <div className="creature-card-actions">
                  {!entry.sourceId && (
                    <button className="btn btn-danger-ghost" onClick={() => onRemove(entry.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span>◇</span>
          <h3>{entries.length ? "No matching creatures" : "Your binder is empty"}</h3>
          <p>{entries.length ? "Try another search." : "Add a creature manually or connect an HTML source."}</p>
        </div>
      )}
    </section>
    </>
  );
}
