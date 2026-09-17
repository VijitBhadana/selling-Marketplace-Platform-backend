import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplyFinanceDto, FinanceDecisionBodyDto } from './dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  // The signed-in buyer's own applications — read by every scheme card.
  @Get('applications/mine')
  myApplications(@Req() req: any) {
    return this.financeService.findMine(req.user.userId);
  }

  @Get('documents/:documentId')
  document(@Req() req: any, @Param('documentId') documentId: string) {
    return this.financeService.getDocument(documentId, req.user.userId);
  }

  @Post('applications/:applicationId/decision')
  decide(@Req() req: any, @Param('applicationId') applicationId: string, @Body() dto: FinanceDecisionBodyDto) {
    return this.financeService.decide(applicationId, req.user.userId, dto);
  }

  // Everyone who applied to any scheme in one of the agency's shops.
  @Get('shops/:listingId/applications')
  shopApplications(@Req() req: any, @Param('listingId') listingId: string) {
    return this.financeService.findForShop(listingId, req.user.userId);
  }

  @Post('products/:productId/apply')
  apply(@Req() req: any, @Param('productId') productId: string, @Body() dto: ApplyFinanceDto) {
    return this.financeService.apply(productId, req.user.userId, dto);
  }
}
