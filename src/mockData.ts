import type { CreatureSize, MiniFigEntry, PrintCatalogue } from "./types";
import { createCatalogue, loadCatalogues, loadPrintCatalogues, saveCatalogues, savePrintCatalogues } from "./storage.ts";

const MOCK_DATA_KEY = "paper-mini-fig-local-mocks-v1";

const creatures: [string, string, CreatureSize, string, string][] = [
  ["goblin", "Goblin Scout", "small", "#65a851", '<path d="M35 38 12 20l10 35m43-17 23-18-10 35"/><ellipse cx="50" cy="47" rx="24" ry="25"/><path d="m34 78-9 48h50l-9-48Z"/>'],
  ["knight", "Human Knight", "medium", "#8da9c4", '<path d="M32 30q18-18 36 0v38H32Z"/><path d="M25 80h50l-5 45H30Z"/><path d="M10 70h20v45L20 130 10 115Z"/><path d="M85 28v105M77 75h16"/>'],
  ["skeleton", "Skeleton Warrior", "medium", "#d9cfad", '<circle cx="50" cy="42" r="23"/><path d="M50 67v47M27 80h46M30 90h40M34 100h32M28 75l-12 34M72 75l12 34M50 114l-22 24M50 114l22 24"/>'],
  ["wolf", "Dire Wolf", "large", "#91a0b0", '<path d="m15 73 12-26 8 15 13-8 30 14 13-12-5 27-15 17-4 33H55l-4-30-15 2-8 28H16l3-42Z"/>'],
  ["ogre", "Mountain Ogre", "large", "#c39771", '<ellipse cx="50" cy="39" rx="21" ry="23"/><path d="M25 64q25-9 50 0l12 49-17 5-4-29v48H34V89l-4 29-17-5Z"/>'],
  ["dragon", "Ember Dragon", "huge", "#dc7054", '<path d="m38 70-28-40 3 65 23-10m26-15 28-40-3 65-23-10"/><path d="m38 35 4-20 9 15 12-8 9 24-14 15 9 38-6 34H38l-7-34 11-40-12-8Z"/>'],
  ["wizard", "Elven Wizard", "medium", "#ac8ed1", '<path d="m50 12-25 40h50Z"/><circle cx="50" cy="65" r="16"/><path d="m37 83-17 54h60L63 83Z"/><path d="M85 40v97"/><circle cx="85" cy="30" r="10"/>'],
  ["spider", "Giant Spider", "large", "#ba8b65", '<ellipse cx="50" cy="84" rx="21" ry="31"/><circle cx="50" cy="48" r="16"/><path d="m31 66-20-22-8 30m28 3L9 72 3 97m28-6-17 14-5 25m60-64 20-22 8 30M69 77l22-5 6 25M69 91l17 14 5 25"/>'],
];

function mockCreature([id, name, creatureSize, color, shape]: typeof creatures[number]): MiniFigEntry {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 100 150"><g fill="${color}" stroke="#273344" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>`;
  return {
    id: `mock-${id}`,
    name,
    createdAt: Date.UTC(2026, 9, 1 + creatures.findIndex((creature) => creature[0] === id)),
    creatureSize,
    imageDataUrl: null,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    imageDriveFileId: null,
    blurHash: null,
    sourceId: null,
    showName: true,
    disableNumbering: false,
  };
}

/** Called only by the local development entry point. Seed once without replacing user data. */
export function seedLocalMockData(): void {
  if (localStorage.getItem(MOCK_DATA_KEY)) return;

  const catalogues = loadCatalogues();
  const existingIds = new Set(catalogues.flatMap((catalogue) => catalogue.entries.map((entry) => entry.id)));
  const additions = creatures.map(mockCreature).filter((entry) => !existingIds.has(entry.id));
  if (catalogues.length) {
    catalogues[0] = {
      ...catalogues[0],
      entries: [...catalogues[0].entries, ...additions],
      updatedAt: Date.now(),
    };
  } else {
    catalogues.push(createCatalogue("Collection", additions));
  }
  saveCatalogues(catalogues);

  const now = Date.now();
  const examples: PrintCatalogue[] = [
    {
      id: "mock-forest-patrol", name: "Forest Patrol (demo)", printed: true,
      entries: [{ creatureId: "mock-goblin", quantity: 6 }, { creatureId: "mock-wolf", quantity: 2 }, { creatureId: "mock-spider", quantity: 3 }],
      paperFormat: "a4", printLayout: "compact", miniSize: 28, createdAt: now, updatedAt: now,
    },
    {
      id: "mock-dungeon-party", name: "Dungeon Party (demo)", printed: true,
      entries: [{ creatureId: "mock-goblin", quantity: 4 }, { creatureId: "mock-skeleton", quantity: 8 }, { creatureId: "mock-knight", quantity: 2 }, { creatureId: "mock-wizard", quantity: 1 }],
      paperFormat: "a4", printLayout: "per-creature", miniSize: 28, createdAt: now, updatedAt: now,
    },
    {
      id: "mock-boss-battle", name: "Boss Battle (demo)", printed: false,
      entries: [{ creatureId: "mock-dragon", quantity: 1 }, { creatureId: "mock-ogre", quantity: 2 }, { creatureId: "mock-goblin", quantity: 4 }],
      paperFormat: "a3", printLayout: "compact", miniSize: 32, createdAt: now, updatedAt: now,
    },
  ];
  const printCatalogues = loadPrintCatalogues();
  const existingCatalogueIds = new Set(printCatalogues.map((catalogue) => catalogue.id));
  savePrintCatalogues([...printCatalogues, ...examples.filter((catalogue) => !existingCatalogueIds.has(catalogue.id))]);
  localStorage.setItem(MOCK_DATA_KEY, "true");
}
