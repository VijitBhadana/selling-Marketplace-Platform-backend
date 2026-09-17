import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApplyJobDto, CreateJobDto, JobQueryDto, ScheduleInterviewDto } from './dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  findAll(@Query() query: JobQueryDto) {
    return this.jobsService.findAll(query);
  }

  // Static routes are declared before ':id' so "mine" / "applications" aren't read as job ids.
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Req() req: any) {
    return this.jobsService.findMine(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/mine')
  myApplications(@Req() req: any) {
    return this.jobsService.findMyApplications(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/:applicationId/resume')
  resume(@Req() req: any, @Param('applicationId') applicationId: string) {
    return this.jobsService.getResume(applicationId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications/:applicationId/schedule-interview')
  scheduleInterview(@Req() req: any, @Param('applicationId') applicationId: string, @Body() dto: ScheduleInterviewDto) {
    return this.jobsService.scheduleInterview(applicationId, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications/:applicationId/reject')
  reject(@Req() req: any, @Param('applicationId') applicationId: string) {
    return this.jobsService.rejectApplication(applicationId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Delete('mine')
  removeAllMine(@Req() req: any) {
    return this.jobsService.removeAllMine(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.jobsService.remove(id, req.user.userId);
  }

  // Only seller (recruiter) accounts post jobs; buyer accounts are the job seekers.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Post()
  create(@Req() req: any, @Body() dto: CreateJobDto) {
    return this.jobsService.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/apply')
  apply(@Req() req: any, @Param('id') id: string, @Body() dto: ApplyJobDto) {
    return this.jobsService.apply(id, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/applications')
  applications(@Req() req: any, @Param('id') id: string) {
    return this.jobsService.findApplications(id, req.user.userId);
  }
}
