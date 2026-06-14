import { useState } from "react";
import type { Catalogue } from "../types";

interface Props {
  catalogues: Catalogue[];
  activeCatalogueId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function CataloguePanel({
  catalogues,
  activeCatalogueId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
}: Props) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    const name = newName.trim() || "Untitled Catalogue";
    onCreate(name);
    setNewName("");
  };

  const startRename = (catalogue: Catalogue) => {
    setEditingId(catalogue.id);
    setEditName(catalogue.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  return (
    <aside className="catalogue-panel">
      <div className="catalogue-header">
        <h2>Catalogues</h2>
      </div>

      <div className="catalogue-create">
        <input
          type="text"
          placeholder="New catalogue name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button className="btn btn-secondary" onClick={handleCreate}>
          + New
        </button>
      </div>

      <ul className="catalogue-list">
        {catalogues.map((cat) => (
          <li
            key={cat.id}
            className={`catalogue-item ${cat.id === activeCatalogueId ? "active" : ""}`}
          >
            {editingId === cat.id ? (
              <input
                className="catalogue-rename-input"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
              />
            ) : (
              <button
                className="catalogue-select-btn"
                onClick={() => onSelect(cat.id)}
              >
                <span className="catalogue-name">{cat.name}</span>
                <span className="catalogue-count">
                  {cat.entries.length} mini
                  {cat.entries.length !== 1 ? "s" : ""}
                </span>
              </button>
            )}
            <div className="catalogue-actions">
              <button
                className="btn-icon"
                title="Rename"
                onClick={() => startRename(cat)}
              >
                ✏️
              </button>
              <button
                className="btn-icon"
                title="Duplicate"
                onClick={() => onDuplicate(cat.id)}
              >
                📋
              </button>
              <button
                className="btn-icon btn-icon-danger"
                title="Delete"
                onClick={() => onDelete(cat.id)}
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
        {catalogues.length === 0 && (
          <li className="catalogue-empty">
            No catalogues yet. Create one above!
          </li>
        )}
      </ul>
    </aside>
  );
}
