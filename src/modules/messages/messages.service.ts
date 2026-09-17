import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async startConversation(buyerId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, shopName: true, title: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId === buyerId) {
      throw new BadRequestException("You can't start a chat with your own shop");
    }

    return this.prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId } },
      update: {},
      create: { listingId, buyerId, sellerId: listing.sellerId },
      include: {
        listing: { select: { id: true, shopName: true, title: true, coverImageUrl: true } },
        seller: { select: { id: true, name: true } },
      },
    });
  }

  async startJobConversation(userId: string, jobId: string, candidateId?: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true, postedById: true } });
    if (!job) throw new NotFoundException('Job not found');

    let buyerId = userId;
    if (job.postedById === userId) {
      // The recruiter opening a chat with one of their applicants.
      if (!candidateId) throw new BadRequestException("You can't start a chat with your own job post");
      const applied = await this.prisma.jobApplication.findUnique({
        where: { jobId_applicantId: { jobId, applicantId: candidateId } },
        select: { id: true },
      });
      if (!applied) throw new ForbiddenException('You can only chat with candidates who applied to this job');
      buyerId = candidateId;
    }

    return this.prisma.conversation.upsert({
      where: { jobId_buyerId: { jobId, buyerId } },
      update: {},
      create: { jobId, buyerId, sellerId: job.postedById },
      include: {
        job: { select: { id: true, title: true, companyName: true } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
      },
    });
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      throw new ForbiddenException('Not part of this conversation');
    }
    return conversation;
  }

  async listMessages(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    // Viewing a conversation marks the other side's messages as read.
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, read: false },
      data: { read: true },
    });
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    await this.assertParticipant(conversationId, senderId);
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId, senderId, content } }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: {} }),
    ]);
    return message;
  }

  async listMyConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        listing: { select: { id: true, shopName: true, title: true, coverImageUrl: true } },
        job: { select: { id: true, title: true, companyName: true } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (conversation) => ({
        ...conversation,
        unreadCount: await this.prisma.message.count({
          where: { conversationId: conversation.id, senderId: { not: userId }, read: false },
        }),
      })),
    );
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: {
        senderId: { not: userId },
        read: false,
        conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      },
    });
    return { count };
  }
}
