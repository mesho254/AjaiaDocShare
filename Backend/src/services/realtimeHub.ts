import { Response } from 'express';
import { User } from '../db/types.js';

export interface CursorState {
  clientId: string;
  user_id: string;
  name: string;
  email: string;
  avatar_color: string;
  selectionFrom: number | null;
  selectionTo: number | null;
  mouseXRatio: number | null;
  mouseY: number | null;
  isTyping: boolean;
  lastTypedAt: number | null;
  updatedAt: number;
}

interface ConnectedClient {
  connectionId: string;
  clientId: string;
  user: User;
  res: Response;
  connectedAt: string;
}

export interface ActiveCollaborator {
  user_id: string;
  name: string;
  email: string;
  avatar_color: string;
}

class RealtimeHub {
  // Keyed by docId -> connectionId -> ConnectedClient
  private rooms = new Map<string, Map<string, ConnectedClient>>();
  // Keyed by docId -> clientId -> CursorState
  private recentCursors = new Map<string, Map<string, CursorState>>();
  // Keyed by docId -> userId -> timestamp of last active request/heartbeat
  private userHeartbeats = new Map<string, Map<string, { user: User; lastSeenAt: number }>>();

  recordHeartbeat(docId: string, user: User): void {
    let heartbeats = this.userHeartbeats.get(docId);
    if (!heartbeats) {
      heartbeats = new Map();
      this.userHeartbeats.set(docId, heartbeats);
    }
    heartbeats.set(user.id, { user, lastSeenAt: Date.now() });
  }

  addClient(
    docId: string,
    connectionId: string,
    clientId: string,
    user: User,
    res: Response
  ): void {
    let room = this.rooms.get(docId);
    if (!room) {
      room = new Map();
      this.rooms.set(docId, room);
    }

    room.set(connectionId, {
      connectionId,
      clientId,
      user,
      res,
      connectedAt: new Date().toISOString()
    });

    this.recordHeartbeat(docId, user);

    let docCursors = this.recentCursors.get(docId);
    if (!docCursors) {
      docCursors = new Map();
      this.recentCursors.set(docId, docCursors);
    }
    if (!docCursors.has(clientId)) {
      docCursors.set(clientId, {
        clientId,
        user_id: user.id,
        name: user.name,
        email: user.email,
        avatar_color: user.avatar_color,
        selectionFrom: 1,
        selectionTo: 1,
        mouseXRatio: null,
        mouseY: null,
        isTyping: false,
        lastTypedAt: null,
        updatedAt: Date.now()
      });
    }

    try {
      res.write(`: connected ${connectionId}\n\n`);
      const collaborators = this.getCollaborators(docId);
      res.write(
        `event: presence\ndata: ${JSON.stringify({
          documentId: docId,
          collaborators
        })}\n\n`
      );

      const activeCursors = this.getCursors(docId);
      for (const c of activeCursors) {
        if (c.clientId !== clientId) {
          res.write(`event: cursor-move\ndata: ${JSON.stringify(c)}\n\n`);
        }
      }
    } catch {
      // ignore initial write error
    }

    this.broadcastPresence(docId);
  }

  removeClient(docId: string, connectionId: string): void {
    const room = this.rooms.get(docId);
    if (!room) return;

    const departing = room.get(connectionId);
    room.delete(connectionId);

    if (room.size === 0) {
      this.rooms.delete(docId);
    }

    if (departing) {
      // Wait 600ms to distinguish a React StrictMode remount from actually leaving the document
      setTimeout(() => {
        const currentRoom = this.rooms.get(docId);
        const stillConnectedWithClientId =
          currentRoom &&
          Array.from(currentRoom.values()).some(
            (c) => c.clientId === departing.clientId
          );

        if (!stillConnectedWithClientId) {
          this.leaveDocument(docId, departing.clientId, departing.user.id);
        }
      }, 600);
    }
  }

  leaveDocument(docId: string, clientId: string, userId?: string): void {
    const docCursors = this.recentCursors.get(docId);
    if (docCursors) {
      docCursors.delete(clientId);
      if (userId) {
        for (const [cId, c] of docCursors.entries()) {
          if (c.user_id === userId) {
            docCursors.delete(cId);
          }
        }
      }
    }

    if (userId) {
      const heartbeats = this.userHeartbeats.get(docId);
      heartbeats?.delete(userId);
    }

    this.sendToRoom(docId, 'cursor-leave', { clientId, userId: userId || null });
    this.broadcastPresence(docId);
  }

  updateCursor(
    docId: string,
    clientId: string,
    user: User,
    update: {
      selectionFrom?: number | null;
      selectionTo?: number | null;
      mouseXRatio?: number | null;
      mouseY?: number | null;
      isTyping?: boolean;
    }
  ): CursorState {
    this.recordHeartbeat(docId, user);

    let docCursors = this.recentCursors.get(docId);
    if (!docCursors) {
      docCursors = new Map();
      this.recentCursors.set(docId, docCursors);
    }

    const prev = docCursors.get(clientId);
    const now = Date.now();
    const lastTypedAt = update.isTyping
      ? now
      : update.isTyping === false
      ? null
      : prev?.lastTypedAt ?? null;
    const isActivelyTyping = Boolean(lastTypedAt && now - lastTypedAt < 1500);

    const cursorState: CursorState = {
      clientId,
      user_id: user.id,
      name: user.name,
      email: user.email,
      avatar_color: user.avatar_color,
      selectionFrom:
        update.selectionFrom !== undefined && update.selectionFrom !== null
          ? update.selectionFrom
          : prev?.selectionFrom ?? 1,
      selectionTo:
        update.selectionTo !== undefined && update.selectionTo !== null
          ? update.selectionTo
          : prev?.selectionTo ?? 1,
      mouseXRatio:
        update.mouseXRatio !== undefined && update.mouseXRatio !== null
          ? update.mouseXRatio
          : prev?.mouseXRatio ?? null,
      mouseY:
        update.mouseY !== undefined && update.mouseY !== null
          ? update.mouseY
          : prev?.mouseY ?? null,
      isTyping: isActivelyTyping,
      lastTypedAt,
      updatedAt: now
    };

    docCursors.set(clientId, cursorState);

    this.sendToRoom(docId, 'cursor-move', cursorState, clientId);
    return cursorState;
  }

  getCursors(docId: string): CursorState[] {
    const docCursors = this.recentCursors.get(docId);
    if (!docCursors) return [];

    const room = this.rooms.get(docId);
    const heartbeats = this.userHeartbeats.get(docId);
    const now = Date.now();
    const active: CursorState[] = [];

    for (const [cId, cursor] of docCursors.entries()) {
      const hasOpenSse =
        room &&
        Array.from(room.values()).some((c) => c.user.id === cursor.user_id);
      const lastHeartbeat = heartbeats?.get(cursor.user_id)?.lastSeenAt ?? 0;
      const recentlyPolled = now - lastHeartbeat < 2500;

      // If the user neither has an open SSE stream nor polled within 2.5s, they left the document
      if (!hasOpenSse && !recentlyPolled) {
        docCursors.delete(cId);
        continue;
      }

      const activelyTyping = Boolean(
        cursor.lastTypedAt && now - cursor.lastTypedAt < 1500
      );
      active.push({
        ...cursor,
        isTyping: activelyTyping
      });
    }
    return active;
  }

  getCollaborators(docId: string): ActiveCollaborator[] {
    const room = this.rooms.get(docId);
    const heartbeats = this.userHeartbeats.get(docId);
    const uniqueByUser = new Map<string, ActiveCollaborator>();
    const now = Date.now();

    if (room) {
      for (const client of room.values()) {
        uniqueByUser.set(client.user.id, {
          user_id: client.user.id,
          name: client.user.name,
          email: client.user.email,
          avatar_color: client.user.avatar_color
        });
      }
    }

    if (heartbeats) {
      for (const [userId, entry] of heartbeats.entries()) {
        if (now - entry.lastSeenAt < 2500) {
          uniqueByUser.set(userId, {
            user_id: entry.user.id,
            name: entry.user.name,
            email: entry.user.email,
            avatar_color: entry.user.avatar_color
          });
        } else {
          heartbeats.delete(userId);
        }
      }
    }

    return Array.from(uniqueByUser.values());
  }

  broadcastPresence(docId: string): void {
    const collaborators = this.getCollaborators(docId);
    this.sendToRoom(docId, 'presence', {
      documentId: docId,
      collaborators
    });
  }

  broadcastDocumentUpdate(
    docId: string,
    payload: {
      title: string;
      content: string;
      updated_at: string;
      updatedBy: User;
      sourceClientId?: string;
    }
  ): void {
    this.sendToRoom(
      docId,
      'doc-update',
      {
        documentId: docId,
        title: payload.title,
        content: payload.content,
        updated_at: payload.updated_at,
        updatedBy: {
          id: payload.updatedBy.id,
          name: payload.updatedBy.name,
          email: payload.updatedBy.email,
          avatar_color: payload.updatedBy.avatar_color
        },
        sourceClientId: payload.sourceClientId || null
      },
      payload.sourceClientId
    );
  }

  private sendToRoom(
    docId: string,
    event: string,
    data: unknown,
    excludeClientId?: string
  ): void {
    const room = this.rooms.get(docId);
    if (!room) return;

    const serialized = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [connectionId, client] of room.entries()) {
      if (excludeClientId && client.clientId === excludeClientId) {
        continue;
      }
      try {
        client.res.write(serialized);
      } catch {
        room.delete(connectionId);
      }
    }
  }
}

export const realtimeHub = new RealtimeHub();
