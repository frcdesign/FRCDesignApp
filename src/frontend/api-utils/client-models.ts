/**
 * A collection of type and result definitions mirroring backend endpoints and/or Onshape.
 */
import { Configuration } from "../configurations/configuration-models";
import { ElementPath, InstancePath } from "../../shared/path";
import { ThumbnailSize, Vendor } from "../../shared/types";

export enum Library {
  FRC_DESIGN_LIB = "frc-design-lib",
  FTC_DESIGN_LIB = "ftc-design-lib",
  MKCAD = "mkcad",
}

export type Favorites = Record<string, Favorite | undefined>;

export interface FavoritesData {
    favorites: Favorites;
    favoriteOrder: string[];
}

export interface Favorite {
  id: string;
  library: Library;
  defaultConfiguration?: Configuration;
}

/**
 * The type of the Onshape tab the app is open in.
 */
export enum ElementType {
  PART_STUDIO = "PARTSTUDIO",
  ASSEMBLY = "ASSEMBLY",
}

export interface LibraryObj {
  documentOrder: string[];
  documents: Documents;
  elements: Elements;
}

export type Documents = Record<string, DocumentObj | undefined>;
export type Elements = Record<string, ElementObj | undefined>;

export interface DocumentObj {
  id: string;
  name: string;
  thumbnailUrls: ThumbnailUrls;
  sortAlphabetically: boolean;
  elementOrder: string[];
  path: InstancePath;
}

export interface ElementObj {
  id: string;
  documentId: string;

  name: string;
  elementType: ElementType;
  microversionId: string;
  isVisible: boolean;
  isOpenComposite: boolean;
  supportsFasten: boolean;
  vendors: Vendor[];
  configurationId?: string;
  thumbnailUrls: ThumbnailUrls;
  path: ElementPath;
}

export interface ThumbnailUrls {
  [ThumbnailSize.TINY]: string;
  [ThumbnailSize.STANDARD]: string;
}

export interface HeightAndWidth {
  height: number;
  width: number;
}

export function getHeightAndWidth(
  size: ThumbnailSize,
  multiplier: number = 1,
): HeightAndWidth {
  const parts = size.split("x");
  return {
    width: parseInt(parts[0]) * multiplier,
    height: parseInt(parts[1]) * multiplier,
  };
}

