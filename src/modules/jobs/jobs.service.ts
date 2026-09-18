import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { jobNearWhere, parseNear } from '../../common/nearby';
import { PUBLICLY_VISIBLE_USER } from '../../common/visibility';
import { ApplyJobDto, CreateJobDto, JobQueryDto, ScheduleInterviewDto } from './dto';

// Cloudes whose categories accept job posts: the "Jobs & Freelancing Cloude" (slug
// 'software'), plus the Financing Cloude — a bank correspondent, DSA or CA firm hiring
// field officers, tele-callers or accountants posts the vacancy in the same finance
// sub-category buyers browse, and candidates apply to it exactly as they do elsewhere.
export const JOB_CLOUDE_SLUGS = ['software', 'financing'];
/** @deprecated Use JOB_CLOUDE_SLUGS — kept so existing imports keep working. */
export const JOBS_CLOUDE_SLUG = JOB_CLOUDE_SLUGS[0];

const DAY_MS = 24 * 60 * 60 * 1000;

const jobInclude = {
  category: { select: { id: true, name: true, slug: true } },
  postedBy: { select: { id: true, name: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobInclude;

// Everything the recruiter sees for an applicant — minus the resume itself, which
// is a multi-MB data URL and is fetched on demand via getResume().
const applicationSelect = {
  id: true,
  jobId: true,
  applicantId: true,
  fullName: true,
  email: true,
  phone: true,
  address: true,
  totalExperience: true,
  currentCompany: true,
  currentDesignation: true,
  currentSalary: true,
  currentLocation: true,
  noticePeriod: true,
  resumeFileName: true,
  status: true,
  interviewAt: true,
  interviewDetails: true,
  appliedAt: true,
  updatedAt: true,
} satisfies Prisma.JobApplicationSelect;

const interviewDateFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'full',
  timeStyle: 'short',
});

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(postedById: string, dto: CreateJobDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, cloude: { select: { slug: true } } },
    });
    if (!category || !JOB_CLOUDE_SLUGS.includes(category.cloude.slug)) {
      throw new BadRequestException('Jobs can only be posted in a Jobs & Freelancing or Financing category.');
    }
    if (dto.salaryMax != null && dto.salaryMax < dto.salaryMin) {
      throw new BadRequestException('Maximum salary cannot be less than the minimum salary.');
    }

    const skills = [...new Set(dto.skills.map((s) => s.trim()).filter(Boolean))];
    if (skills.length === 0) throw new BadRequestException('Add at least one required skill.');

    return this.prisma.job.create({
      data: {
        title: dto.title.trim(),
        companyName: dto.companyName.trim(),
        isStartup: dto.isStartup ?? false,
        jobType: dto.jobType,
        workMode: dto.workMode,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax ?? null,
        salaryPeriod: dto.salaryPeriod,
        experience: dto.experience.trim(),
        skills,
        responsibilities: dto.responsibilities.trim(),
        description: dto.description?.trim() || null,
        location: dto.location.trim(),
        pincode: dto.pincode?.trim() || null,
        categoryId: category.id,
        postedById,
      },
      include: jobInclude,
    });
  }

  async findAll(query: JobQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;

    const where: Prisma.JobWhereInput = { isClosed: false, postedBy: PUBLICLY_VISIBLE_USER };

    const category: Prisma.CategoryWhereInput = {};
    if (query.cloudeSlug) category.cloude = { slug: query.cloudeSlug };
    if (query.categorySlug) category.slug = query.categorySlug;
    if (Object.keys(category).length > 0) where.category = category;
    if (query.categoryId) where.categoryId = query.categoryId;

    if (query.location?.trim()) where.location = { contains: query.location.trim(), mode: 'insensitive' };
    const near = jobNearWhere(parseNear(query));
    if (near) where.AND = [near];
    if (query.jobType) where.jobType = query.jobType;
    if (query.workMode) where.workMode = query.workMode;
    if (query.postedWithinDays) {
      where.createdAt = { gte: new Date(Date.now() - query.postedWithinDays * DAY_MS) };
    }

    const q = query.q?.trim();
    if (q) {
      // Skills are a text[] — `has` is exact-match, so try the common casings.
      const skillVariants = [...new Set([q, q.toLowerCase(), q.toUpperCase(), q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()])];
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
        { skills: { hasSome: skillVariants } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: jobInclude,
        orderBy: { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  findMine(postedById: string) {
    return this.prisma.job.findMany({
      where: { postedById },
      include: jobInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Deletes a job post; its responses and chats cascade with it. */
  async remove(id: string, recruiterId: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { postedById: true } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.postedById !== recruiterId) throw new ForbiddenException('Only the recruiter who posted this job can delete it.');
    await this.prisma.job.delete({ where: { id } });
  }

  /** Deletes every job the recruiter posted, with all their responses. */
  async removeAllMine(recruiterId: string) {
    const { count } = await this.prisma.job.deleteMany({ where: { postedById: recruiterId } });
    return { deleted: count };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findFirst({ where: { id, postedBy: PUBLICLY_VISIBLE_USER }, include: jobInclude });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async apply(jobId: string, applicantId: string, dto: ApplyJobDto) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, postedBy: PUBLICLY_VISIBLE_USER },
      select: { id: true, title: true, postedById: true, isClosed: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.isClosed) throw new BadRequestException('This job is no longer accepting applications.');
    if (job.postedById === applicantId) throw new BadRequestException("You can't apply to your own job post.");

    const existing = await this.prisma.jobApplication.findUnique({
      where: { jobId_applicantId: { jobId, applicantId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You have already applied for this job.');

    const fullName = dto.fullName.trim();

    // Array-form transaction (not interactive): the resume can be several MB, and an
    // interactive transaction's 5s timeout could expire while it uploads.
    try {
      const [application] = await this.prisma.$transaction([
        this.prisma.jobApplication.create({
          data: {
            jobId,
            applicantId,
            fullName,
            email: dto.email.trim(),
            phone: dto.phone.trim(),
            address: dto.address.trim(),
            totalExperience: dto.totalExperience,
            currentCompany: dto.currentCompany?.trim() || null,
            currentDesignation: dto.currentDesignation?.trim() || null,
            currentSalary: dto.currentSalary ?? null,
            currentLocation: dto.currentLocation.trim(),
            noticePeriod: dto.noticePeriod.trim(),
            resumeUrl: dto.resumeDataUrl,
            resumeFileName: dto.resumeFileName.trim(),
          },
          select: applicationSelect,
        }),
        this.prisma.notification.create({
          data: {
            userId: job.postedById,
            type: 'JOB_APPLICATION',
            title: 'New job application',
            body: `${fullName} applied for ${job.title}`,
            jobId,
          },
        }),
      ]);
      return application;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('You have already applied for this job.');
      throw err;
    }
  }

  // Lets a candidate's job cards show "Applied" / "Interview scheduled" instead of Apply.
  findMyApplications(applicantId: string) {
    return this.prisma.jobApplication.findMany({
      where: { applicantId },
      select: { id: true, jobId: true, status: true, interviewAt: true, appliedAt: true },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async findApplications(jobId: string, recruiterId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { postedById: true } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.postedById !== recruiterId) throw new ForbiddenException('Only the recruiter who posted this job can see its responses.');

    return this.prisma.jobApplication.findMany({
      where: { jobId },
      select: applicationSelect,
      orderBy: { appliedAt: 'desc' },
    });
  }

  async getResume(applicationId: string, userId: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: { applicantId: true, resumeUrl: true, resumeFileName: true, job: { select: { postedById: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.job.postedById !== userId && application.applicantId !== userId) {
      throw new ForbiddenException('Not allowed to view this resume.');
    }
    if (!application.resumeUrl) throw new NotFoundException('No resume was uploaded with this application.');
    return { fileName: application.resumeFileName ?? 'resume', dataUrl: application.resumeUrl };
  }

  private async getOwnedApplication(applicationId: string, recruiterId: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        job: { select: { id: true, title: true, companyName: true, postedById: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.job.postedById !== recruiterId) {
      throw new ForbiddenException('Only the recruiter who posted this job can do that.');
    }
    return application;
  }

  // "Accept" = schedule an interview. The date/time and details land in the
  // candidate's chat for this job as a message from the recruiter, plus a bell alert.
  async scheduleInterview(applicationId: string, recruiterId: string, dto: ScheduleInterviewDto) {
    const application = await this.getOwnedApplication(applicationId, recruiterId);
    if (application.status === 'REJECTED') {
      throw new BadRequestException('This candidate has already been rejected.');
    }

    const interviewAt = new Date(dto.interviewAt);
    if (Number.isNaN(interviewAt.getTime())) throw new BadRequestException('Invalid interview date/time.');
    if (interviewAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Pick an interview date and time in the future.');
    }

    const { job, applicantId } = application;
    const details = dto.interviewDetails?.trim() || null;
    const when = `${interviewDateFormat.format(interviewAt)} IST`;
    const isReschedule = application.status === 'INTERVIEW_SCHEDULED';

    const content = [
      isReschedule
        ? `Your interview for ${job.title} at ${job.companyName} has been rescheduled.`
        : `Congratulations! Your application for ${job.title} at ${job.companyName} has been accepted.`,
      '',
      `📅 Interview: ${when}`,
      details ? `📍 Details: ${details}` : null,
      '',
      'Reply here if you have any questions.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const conversation = await this.prisma.conversation.upsert({
      where: { jobId_buyerId: { jobId: job.id, buyerId: applicantId } },
      update: {},
      create: { jobId: job.id, buyerId: applicantId, sellerId: recruiterId },
      select: { id: true },
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: 'INTERVIEW_SCHEDULED', interviewAt, interviewDetails: details },
        select: applicationSelect,
      }),
      this.prisma.message.create({ data: { conversationId: conversation.id, senderId: recruiterId, content } }),
      this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
      this.prisma.notification.create({
        data: {
          userId: applicantId,
          type: 'INTERVIEW_SCHEDULED',
          title: isReschedule ? 'Interview rescheduled' : 'Interview scheduled',
          body: `${job.companyName} scheduled your interview for ${job.title} on ${when}. Open the chat for details.`,
          jobId: job.id,
        },
      }),
    ]);

    return { ...updated, conversationId: conversation.id };
  }

  async rejectApplication(applicationId: string, recruiterId: string) {
    await this.getOwnedApplication(applicationId, recruiterId);
    return this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'REJECTED' },
      select: applicationSelect,
    });
  }
}
