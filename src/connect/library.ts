import { Library } from "../api-utils/client-models";
import { ConfigurationResult } from "../configurations/configuration-models";
import {
    Collection,
    DB,
    OrderedCollection,
    TypedCollection,
    TypedDoc
} from "./db";
import {
    DocumentData,
    ElementData,
    FavoriteData,
    LibraryData,
    LibraryUserData
} from "./db-models";

class ConfigurationsRef extends TypedCollection<ConfigurationResult> {
    configuration(configurationId: string) {
        return this.doc(configurationId);
    }
}

class ElementsRef extends OrderedCollection<ElementData> {
    element(elementId: string) {
        return this.doc(elementId);
    }
}

class DocumentRef extends TypedDoc<DocumentData> {
    get elements(): ElementsRef {
        return new ElementsRef(
            this.collection(Collection.ELEMENTS),
            this,
            "elementOrder"
        );
    }

    get configurations(): ConfigurationsRef {
        return new ConfigurationsRef(
            this.collection(Collection.CONFIGURATIONS)
        );
    }
}

class DocumentsRef extends OrderedCollection<DocumentData> {
    document(documentId: string): DocumentRef {
        return new DocumentRef(this.ref.doc(documentId));
    }
}

class FavoritesRef extends OrderedCollection<FavoriteData> {
    favorite(favoriteId: string) {
        return this.doc(favoriteId);
    }
}

class LibraryUserDataRef extends TypedDoc<LibraryUserData> {
    get favorites(): FavoritesRef {
        return new FavoritesRef(
            this.collection(Collection.FAVORITES),
            this,
            "favoriteOrder"
        );
    }
}

class AllLibraryUserDataRef extends TypedCollection<LibraryUserData> {
    userDataFor(userId: string): LibraryUserDataRef {
        return new LibraryUserDataRef(this.ref.doc(userId));
    }
}

export class LibraryRef extends TypedDoc<LibraryData> {
    get documents(): DocumentsRef {
        return new DocumentsRef(
            this.collection(Collection.DOCUMENTS),
            this,
            "documentOrder"
        );
    }

    get userData(): AllLibraryUserDataRef {
        return new AllLibraryUserDataRef(
            this.collection(Collection.LIBRARY_USER_DATA)
        );
    }
}

export function getLibrary(library: Library): LibraryRef {
    return new LibraryRef(DB.collection(Collection.LIBRARIES).doc(library));
}
