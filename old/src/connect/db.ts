import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import {
    CollectionReference,
    DocumentReference,
    FieldValue,
    getFirestore
} from "firebase-admin/firestore";

if (getApps().length === 0) {
    initializeApp({
        credential: applicationDefault(),
        projectId: "frc-design-lib"
    });
}

export const DB = getFirestore();

export enum DbCollection {
    LIBRARIES = "libraries",
    DOCUMENTS = "documents",
    ELEMENTS = "elements",
    CONFIGURATIONS = "configurations",
    LIBRARY_USER_DATA = "library-user-data",
    FAVORITES = "favorites",
    USER_DATA = "user-data",
    SESSIONS = "sessions"
}

export class TypedDoc<T> {
    constructor(readonly ref: DocumentReference) {}

    async get(): Promise<T | null> {
        const snap = await this.ref.get();
        if (!snap.exists) return null;
        return snap.data() as T;
    }

    async set(data: T): Promise<void> {
        await this.ref.set(data as FirebaseFirestore.DocumentData);
    }

    async update(data: Partial<T>): Promise<void> {
        await this.ref.update(data as Record<string, unknown>);
    }

    async delete(): Promise<void> {
        await this.ref.delete();
    }

    collection(name: DbCollection): CollectionReference {
        return this.ref.collection(name);
    }
}

export class TypedCollection<T> {
    constructor(readonly ref: CollectionReference) {}

    doc(id: string): TypedDoc<T> {
        return new TypedDoc<T>(this.ref.doc(id));
    }

    async list(): Promise<Array<{ id: string; data: T }>> {
        const snap = await this.ref.get();
        return snap.docs.map((d) => ({ id: d.id, data: d.data() as T }));
    }

    async keys(): Promise<string[]> {
        const snap = await this.ref.get();
        return snap.docs.map((d) => d.id);
    }
}

/**
 * A typed collection whose iteration order is maintained in an `orderKey` field of a parent document.
 */
export class OrderedCollection<T> {
    constructor(
        readonly ref: CollectionReference,
        private readonly parent: TypedDoc<any>,
        private readonly orderKey: string
    ) {}

    doc(id: string): TypedDoc<T> {
        return new TypedDoc<T>(this.ref.doc(id));
    }

    async keys(): Promise<string[]> {
        const data = await this.parent.get();
        return data?.[this.orderKey] ?? [];
    }

    async list(): Promise<Array<{ id: string; data: T }>> {
        const ids = await this.keys();
        const snaps = await Promise.all(
            ids.map((id) => this.ref.doc(id).get())
        );
        return snaps
            .filter((s) => s.exists)
            .map((s) => ({ id: s.id, data: s.data() as T }));
    }

    async add(id: string, data: T): Promise<void> {
        await this.ref.doc(id).set(data as FirebaseFirestore.DocumentData);
        await this.parent.ref.update({
            [this.orderKey]: FieldValue.arrayUnion(id)
        });
    }

    async remove(id: string): Promise<void> {
        await this.ref.doc(id).delete();
        await this.parent.ref.update({
            [this.orderKey]: FieldValue.arrayRemove(id)
        });
    }
}
