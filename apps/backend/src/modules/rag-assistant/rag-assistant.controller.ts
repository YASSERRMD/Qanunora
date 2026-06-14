import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Request,
} from '@nestjs/common';
import { RagChatService } from './rag-chat.service';

class CreateSessionDto {
  legislativeItemId?: string;
  title?: string;
}

class ChatDto {
  message: string;
  provider?: string;
}

@Controller('assistant')
export class RagAssistantController {
  constructor(private readonly chatService: RagChatService) {}

  @Post('sessions')
  createSession(
    @Body() dto: CreateSessionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.chatService.createSession(req.user.userId, dto.legislativeItemId, dto.title);
  }

  @Get('sessions')
  getSessions(@Request() req: { user: { userId: string } }) {
    return this.chatService.getSessions(req.user.userId);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.chatService.getSession(id);
  }

  @Delete('sessions/:id')
  deleteSession(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.chatService.deleteSession(id, req.user.userId);
  }

  @Post('sessions/:id/chat')
  chat(
    @Param('id') id: string,
    @Body() dto: ChatDto,
    @Request() req: { user: { userId: string; role: string } },
  ) {
    return this.chatService.chat(
      id,
      req.user.userId,
      dto.message,
      req.user.role ?? 'VIEWER',
      dto.provider,
    );
  }
}
