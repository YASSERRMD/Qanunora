import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface JoinDocumentPayload {
  documentId: string;
  userId: string;
}

interface CursorPayload {
  documentId: string;
  userId: string;
  position: number;
  line: number;
}

interface ContentChangePayload {
  documentId: string;
  userId: string;
  patch: string;
  timestamp: number;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/collaboration' })
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  // documentId -> Set<userId>
  private readonly presence = new Map<string, Set<string>>();
  // socketId -> { documentId, userId }
  private readonly socketMap = new Map<string, { documentId: string; userId: string }>();

  afterInit(_server: Server) {
    this.logger.log('Collaboration gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const info = this.socketMap.get(client.id);
    if (info) {
      this.leaveDocument(client, info.documentId, info.userId);
      this.socketMap.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_document')
  handleJoinDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinDocumentPayload,
  ) {
    const { documentId, userId } = payload;
    const room = `doc:${documentId}`;

    void client.join(room);
    this.socketMap.set(client.id, { documentId, userId });

    const users = this.presence.get(documentId) ?? new Set<string>();
    users.add(userId);
    this.presence.set(documentId, users);

    client.to(room).emit('user_joined', {
      userId,
      documentId,
      activeUsers: Array.from(users),
    });

    return { success: true, activeUsers: Array.from(users) };
  }

  @SubscribeMessage('leave_document')
  handleLeaveDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinDocumentPayload,
  ) {
    const { documentId, userId } = payload;
    this.leaveDocument(client, documentId, userId);
    this.socketMap.delete(client.id);
    return { success: true };
  }

  @SubscribeMessage('cursor_position')
  handleCursorPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CursorPayload,
  ) {
    const room = `doc:${payload.documentId}`;
    client.to(room).emit('cursor_update', payload);
    return { success: true };
  }

  @SubscribeMessage('content_change')
  handleContentChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ContentChangePayload,
  ) {
    const room = `doc:${payload.documentId}`;
    client.to(room).emit('content_patch', payload);
    return { success: true };
  }

  getPresence(documentId: string): string[] {
    return Array.from(this.presence.get(documentId) ?? []);
  }

  private leaveDocument(client: Socket, documentId: string, userId: string) {
    const room = `doc:${documentId}`;
    void client.leave(room);

    const users = this.presence.get(documentId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.presence.delete(documentId);
      }
    }

    client.to(room).emit('user_left', {
      userId,
      documentId,
      activeUsers: Array.from(this.presence.get(documentId) ?? []),
    });
  }
}
