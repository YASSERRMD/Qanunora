import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from '@prisma/client';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Map<userId, socketId[]>
  private userSockets = new Map<string, string[]>();

  afterInit(_server: Server) {
    this.logger.log('WebSocket notifications gateway initialized');
  }

  handleConnection(client: Socket) {
    // Expect the client to send userId as a query param on connection
    const userId = client.handshake.query['userId'] as string | undefined;
    if (!userId) {
      this.logger.warn(`Client ${client.id} connected without userId — disconnecting`);
      client.disconnect();
      return;
    }
    const existing = this.userSockets.get(userId) ?? [];
    this.userSockets.set(userId, [...existing, client.id]);
    client.data['userId'] = userId;
    this.logger.log(`Client ${client.id} connected for user ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data['userId'] as string | undefined;
    if (!userId) return;
    const existing = this.userSockets.get(userId) ?? [];
    const updated = existing.filter((id) => id !== client.id);
    if (updated.length === 0) {
      this.userSockets.delete(userId);
    } else {
      this.userSockets.set(userId, updated);
    }
    this.logger.log(`Client ${client.id} disconnected from user ${userId}`);
  }

  async sendToUser(userId: string, notification: Notification): Promise<void> {
    const sockets = this.userSockets.get(userId) ?? [];
    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification', notification);
    });
  }
}
