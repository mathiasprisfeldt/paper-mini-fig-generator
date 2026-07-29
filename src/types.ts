export type MiniSize = 24 | 28 | 32;

export type PaperFormat = "a4" | "a3";
export type PrintLayout = "compact" | "per-creature";

export type CreatureSize =
  | "tiny"
  | "small"
  | "medium"
  | "large"
  | "huge"
  | "gargantuan";

export interface MiniFigEntry {
  id: string;
  name: string;
  imageDataUrl: string | null;
  imageUrl: string | null;
  imageDriveFileId: string | null;
  blurHash: string | null;
  sourceId: string | null;
  showName: boolean;
  miniSize: MiniSize;
  creatureSize: CreatureSize;
}

export interface PrintableMiniFigEntry extends MiniFigEntry {
  quantity: number;
}

interface CreatureSourceBase {
  id: string;
  name: string;
  updatedAt: number;
}

export interface HtmlCreatureSource extends CreatureSourceBase {
  type: "html";
  url: string;
  selector: string;
}

export interface DriveCreatureSource extends CreatureSourceBase {
  type: "drive";
  folderId: string;
  folderName: string;
}

export type CreatureSource = HtmlCreatureSource | DriveCreatureSource;

export interface SourceRefreshResult {
  total: number;
  added: number;
  removed: number;
}

export interface Catalogue {
  id: string;
  name: string;
  entries: MiniFigEntry[];
  createdAt: number;
  updatedAt: number;
}
