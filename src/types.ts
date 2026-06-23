export type MiniSize = 24 | 28 | 32;

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
  quantity: number;
  showName: boolean;
  miniSize: MiniSize;
  creatureSize: CreatureSize;
}

export interface Catalogue {
  id: string;
  name: string;
  entries: MiniFigEntry[];
  createdAt: number;
  updatedAt: number;
}
