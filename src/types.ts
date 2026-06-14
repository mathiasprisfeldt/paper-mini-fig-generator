export interface MiniFigEntry {
  id: string;
  name: string;
  imageDataUrl: string | null;
  quantity: number;
  showName: boolean;
}

export interface Catalogue {
  id: string;
  name: string;
  entries: MiniFigEntry[];
  createdAt: number;
  updatedAt: number;
}
