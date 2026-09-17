import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendMessageDto, StartConversationDto, StartJobConversationDto } from './dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.messagesService.listMyConversations(req.user.userId);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.messagesService.getUnreadCount(req.user.userId);
  }

  @Post('conversations')
  startConversation(@Req() req: any, @Body() dto: StartConversationDto) {
    return this.messagesService.startConversation(req.user.userId, dto.listingId);
  }

  @Post('job-conversations')
  startJobConversation(@Req() req: any, @Body() dto: StartJobConversationDto) {
    return this.messagesService.startJobConversation(req.user.userId, dto.jobId, dto.candidateId);
  }

  @Get('conversations/:id')
  listMessages(@Req() req: any, @Param('id') id: string) {
    return this.messagesService.listMessages(id, req.user.userId);
  }

  @Post('conversations/:id')
  sendMessage(@Req() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(id, req.user.userId, dto.content);
  }
}
