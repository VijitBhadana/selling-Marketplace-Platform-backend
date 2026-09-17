import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PUBLICLY_VISIBLE_USER } from '../../common/visibility';
import { FINANCING_CLOUDE_SLUG, financeItemType } from '../products/finance-details';
import { ApplyFinanceDto, FinanceDecisionBodyDto, FinanceDecisionDto } from './dto';
import { DOCUMENT_LABELS, normalizeDocuments } from './documents';
import { loanQuote, premiumQuote } from './quote';

// Financing Cloude — buyers apply for an agency's scheme (a loan, a policy, an investment
// product or a paid service) instead of buying it: nothing goes through the cart, the
// agency reads the papers and approves or rejects. Same shape as the Jobs Cloude's
// application flow, right down to the decision landing in the applicant's chat.

const rupees = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (value: number) => `Rs ${rupees.format(Math.round(value))}`;

// Everything the agency sees for an application, minus the scanned papers themselves —
// those are multi-MB data URLs, fetched one at a time via getDocument().
const applicationSelect = {
  id: true,
  productId: true,
  listingId: true,
  applicantId: true,
  fullName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  address: true,
  city: true,
  pincode: true,
  occupation: true,
  employerName: true,
  monthlyIncome: true,
  existingEmi: true,
  creditScore: true,
  requestedAmount: true,
  tenureMonths: true,
  purpose: true,
  nomineeName: true,
  nomineeRelation: true,
  quote: true,
  termsSnapshot: true,
  acceptedTerms: true,
  status: true,
  sellerNote: true,
  approvedAmount: true,
  approvedRate: true,
  approvedTenure: true,
  decidedAt: true,
  appliedAt: true,
  updatedAt: true,
  product: { select: { id: true, name: true, financeDetails: true } },
  documents: { select: { id: true, docType: true, docNumber: true, fileName: true, uploadedAt: true } },
} satisfies Prisma.FinanceApplicationSelect;

type Raw = Record<string, any>;

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Whole years between a YYYY-MM-DD date of birth and today. */
function ageFrom(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async apply(productId: string, applicantId: string, dto: ApplyFinanceDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, listing: { seller: PUBLICLY_VISIBLE_USER } },
      include: {
        listing: {
          select: { id: true, sellerId: true, shopName: true, title: true, cloude: { select: { slug: true } } },
        },
      },
    });
    if (!product) throw new NotFoundException('Scheme not found');
    if (product.listing.cloude?.slug !== FINANCING_CLOUDE_SLUG) {
      throw new BadRequestException('This item is not a financing scheme.');
    }

    const details = (product.financeDetails ?? null) as Raw | null;
    const type = financeItemType(details);
    if (!details || !type) {
      throw new BadRequestException("The agency hasn't published this scheme's terms yet — chat with them instead.");
    }
    if (product.listing.sellerId === applicantId) throw new BadRequestException("You can't apply for your own scheme.");
    if (!dto.acceptedTerms) throw new BadRequestException('Please accept the terms & conditions of this scheme to apply.');

    const existing = await this.prisma.financeApplication.findUnique({
      where: { productId_applicantId: { productId, applicantId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You have already applied for this scheme.');

    const { requestedAmount, tenureMonths } = this.checkEligibility(type, details, dto);
    const quote = this.buildQuote(type, details, product, requestedAmount, tenureMonths);
    const documents = normalizeDocuments(Array.isArray(details.documents) ? details.documents : [], dto.documents);

    const shopName = product.listing.shopName || product.listing.title;
    const fullName = dto.fullName.trim();

    // Array-form transaction (not interactive): a dozen scanned papers can be tens of MB,
    // and an interactive transaction's 5s timeout could expire while they are written.
    try {
      const [application] = await this.prisma.$transaction([
        this.prisma.financeApplication.create({
          data: {
            productId,
            listingId: product.listing.id,
            applicantId,
            sellerId: product.listing.sellerId,
            fullName,
            email: dto.email.trim(),
            phone: dto.phone.trim(),
            dateOfBirth: dto.dateOfBirth?.trim() || null,
            address: dto.address.trim(),
            city: dto.city?.trim() || null,
            pincode: dto.pincode?.trim() || null,
            occupation: dto.occupation?.trim() || null,
            employerName: dto.employerName?.trim() || null,
            monthlyIncome: dto.monthlyIncome ?? null,
            existingEmi: dto.existingEmi ?? null,
            creditScore: dto.creditScore ?? null,
            requestedAmount: requestedAmount ?? null,
            tenureMonths: tenureMonths ?? null,
            purpose: dto.purpose?.trim() || null,
            nomineeName: dto.nomineeName?.trim() || null,
            nomineeRelation: dto.nomineeRelation?.trim() || null,
            quote: (quote ?? Prisma.DbNull) as Prisma.InputJsonValue,
            // The scheme exactly as it stood when they agreed to it — later edits by the
            // agency can never change the terms this application was made under.
            termsSnapshot: details as Prisma.InputJsonObject,
            acceptedTerms: true,
            documents: { create: documents },
          },
          select: applicationSelect,
        }),
        this.prisma.notification.create({
          data: {
            userId: product.listing.sellerId,
            type: 'FINANCE_APPLICATION',
            title: type === 'LOAN' ? 'New loan application' : 'New scheme application',
            body: `${fullName} applied for ${product.name} at ${shopName}${
              requestedAmount ? ` — ${money(requestedAmount)}` : ''
            }`,
            listingId: product.listing.id,
          },
        }),
      ]);
      return application;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('You have already applied for this scheme.');
      throw err;
    }
  }

  /**
   * Checks what the applicant asked for against the scheme's published limits — the amount
   * and tenure bands, the age and income floors, the CIBIL cut-off and who the agency lends
   * to. Failing any of these is the agency's own rule, so the message says which one.
   */
  private checkEligibility(type: string, details: Raw, dto: ApplyFinanceDto) {
    const amount = dto.requestedAmount != null ? Math.round(dto.requestedAmount) : undefined;
    const tenure = dto.tenureMonths;

    if (type === 'LOAN') {
      if (!amount) throw new BadRequestException('Please enter how much you want to borrow.');
      if (!tenure) throw new BadRequestException('Please choose how long you want to repay over.');
      if (amount < Number(details.amountMin)) {
        throw new BadRequestException(`This scheme starts at ${money(Number(details.amountMin))}.`);
      }
      if (details.amountMax != null && amount > Number(details.amountMax)) {
        throw new BadRequestException(`This scheme goes up to ${money(Number(details.amountMax))}.`);
      }
      if (tenure < Number(details.tenureMin)) {
        throw new BadRequestException(`The minimum tenure for this scheme is ${details.tenureMin} months.`);
      }
      if (details.tenureMax != null && tenure > Number(details.tenureMax)) {
        throw new BadRequestException(`The maximum tenure for this scheme is ${details.tenureMax} months.`);
      }
      if (Array.isArray(details.employmentTypes) && details.employmentTypes.length > 0) {
        if (!dto.occupation) throw new BadRequestException('Please tell the agency what you do for a living.');
        if (!details.employmentTypes.includes(dto.occupation)) {
          throw new BadRequestException('This scheme is not open to your employment type — check "Who can apply" on the scheme.');
        }
      }
      if (details.minMonthlyIncome != null) {
        if (dto.monthlyIncome == null) throw new BadRequestException('Please enter your monthly income.');
        if (dto.monthlyIncome < Number(details.minMonthlyIncome)) {
          throw new BadRequestException(`This scheme needs a monthly income of at least ${money(Number(details.minMonthlyIncome))}.`);
        }
      }
      if (details.minCreditScore != null && dto.creditScore != null && dto.creditScore < Number(details.minCreditScore)) {
        throw new BadRequestException(`This scheme needs a CIBIL score of at least ${details.minCreditScore}.`);
      }
    }

    if (type === 'INSURANCE') {
      if (!amount) throw new BadRequestException('Please enter the cover (sum assured) you want.');
      if (amount < Number(details.coverMin)) throw new BadRequestException(`The minimum cover on this policy is ${money(Number(details.coverMin))}.`);
      if (details.coverMax != null && amount > Number(details.coverMax)) {
        throw new BadRequestException(`The maximum cover on this policy is ${money(Number(details.coverMax))}.`);
      }
    }

    if (type === 'INVESTMENT') {
      if (!amount) throw new BadRequestException('Please enter how much you want to invest.');
      if (amount < Number(details.minInvestment)) {
        throw new BadRequestException(`The minimum investment in this scheme is ${money(Number(details.minInvestment))}.`);
      }
    }

    const age = ageFrom(dto.dateOfBirth);
    const minAge = type === 'INSURANCE' ? details.entryAgeMin : details.minAge;
    const maxAge = type === 'INSURANCE' ? details.entryAgeMax : details.maxAge;
    if (age != null) {
      if (minAge != null && age < Number(minAge)) throw new BadRequestException(`You need to be at least ${minAge} to apply for this scheme.`);
      if (maxAge != null && age > Number(maxAge)) throw new BadRequestException(`This scheme is open up to age ${maxAge}.`);
    } else if (minAge != null || maxAge != null) {
      throw new BadRequestException('Please enter your date of birth — this scheme has an age limit.');
    }

    return { requestedAmount: amount, tenureMonths: tenure };
  }

  /** The costing shown to the applicant and kept with the application (see quote.ts). */
  private buildQuote(type: string, details: Raw, product: { price: Prisma.Decimal | null }, amount?: number, tenure?: number) {
    if (type === 'LOAN' && amount && tenure) return loanQuote(details, amount, tenure) as unknown as Prisma.InputJsonObject;
    if (type === 'INSURANCE' && product.price != null) {
      return premiumQuote(details, Number(product.price), details.policyTermMin ? Number(details.policyTermMin) : undefined) as Prisma.InputJsonObject;
    }
    return null;
  }

  /** The applicant's own applications — drives the "Applied" state on every scheme card. */
  findMine(applicantId: string) {
    return this.prisma.financeApplication.findMany({
      where: { applicantId },
      select: {
        id: true,
        productId: true,
        listingId: true,
        status: true,
        requestedAmount: true,
        approvedAmount: true,
        sellerNote: true,
        appliedAt: true,
        product: { select: { name: true } },
        listing: { select: { id: true, shopName: true, title: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /** Every application sent to one of the agency's schemes — only its owner can read them. */
  async findForShop(listingId: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
    if (!listing) throw new NotFoundException('Shop not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Only the agency that posted this shop can see its applications.');

    return this.prisma.financeApplication.findMany({
      where: { listingId },
      select: applicationSelect,
      orderBy: { appliedAt: 'desc' },
    });
  }

  /** One scanned paper, for the agency it was sent to or the applicant who uploaded it. */
  async getDocument(documentId: string, userId: string) {
    const document = await this.prisma.financeDocument.findUnique({
      where: { id: documentId },
      select: {
        docType: true,
        fileName: true,
        dataUrl: true,
        application: { select: { sellerId: true, applicantId: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (document.application.sellerId !== userId && document.application.applicantId !== userId) {
      throw new ForbiddenException('Not allowed to view this document.');
    }
    return { fileName: document.fileName, label: DOCUMENT_LABELS[document.docType] ?? document.docType, dataUrl: document.dataUrl };
  }

  /**
   * The agency's answer: mark it under review, approve it (with the amount, rate and tenure
   * actually sanctioned) or reject it. Like a recruiter's interview invite, the decision
   * lands in the applicant's chat for this shop, plus a bell alert.
   */
  async decide(applicationId: string, sellerId: string, dto: FinanceDecisionBodyDto) {
    const application = await this.prisma.financeApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        listingId: true,
        requestedAmount: true,
        tenureMonths: true,
        termsSnapshot: true,
        seller: { select: { id: true } },
        product: { select: { name: true } },
        listing: { select: { id: true, shopName: true, title: true, sellerId: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.listing.sellerId !== sellerId) {
      throw new ForbiddenException('Only the agency that received this application can decide on it.');
    }

    const details = (application.termsSnapshot ?? {}) as Raw;
    const isLoan = financeItemType(details) === 'LOAN';
    const shopName = application.listing.shopName || application.listing.title;
    const note = dto.note?.trim() || null;

    const approved = dto.status === FinanceDecisionDto.APPROVED;
    const approvedAmount = approved ? dto.approvedAmount ?? application.requestedAmount ?? null : null;
    const approvedRate = approved ? dto.approvedRate ?? (isLoan ? Number(details.interestRateMin) || null : null) : null;
    const approvedTenure = approved ? dto.approvedTenure ?? application.tenureMonths ?? null : null;

    // An approved loan is re-costed on the sanctioned figures, so the borrower is told the
    // instalment they will actually pay rather than the one they asked for.
    const sanction =
      approved && isLoan && approvedAmount && approvedTenure ? loanQuote(details, approvedAmount, approvedTenure, approvedRate ?? undefined) : null;

    const content = [
      approved
        ? `Good news! Your application for ${application.product.name} at ${shopName} has been approved.`
        : dto.status === FinanceDecisionDto.REJECTED
          ? `Your application for ${application.product.name} at ${shopName} could not be approved this time.`
          : `${shopName} is reviewing your application for ${application.product.name}.`,
      '',
      ...(approved && approvedAmount ? [`Sanctioned: ${money(approvedAmount)}`] : []),
      ...(approved && approvedRate ? [`Interest rate: ${approvedRate}% p.a. (${details.interestType === 'FLAT' ? 'flat' : 'reducing balance'})`] : []),
      ...(sanction
        ? [
            `Tenure: ${sanction.tenureMonths} months (${sanction.instalmentCount} instalments)`,
            `Instalment: ${money(sanction.instalment)}`,
            `Total interest: ${money(sanction.totalInterest)}`,
            `Total repayable: ${money(sanction.totalPayable)}`,
            ...(sanction.processingFee ? [`Processing fee: ${money(sanction.processingFee + sanction.gstOnFee)} (incl. GST)`] : []),
            `Amount credited to you: ${money(sanction.netDisbursal)}`,
          ]
        : []),
      ...(note ? ['', `Note: ${note}`] : []),
      '',
      'Reply here if you have any questions.',
    ].join('\n');

    const conversation = await this.prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId: application.listingId, buyerId: application.applicantId } },
      update: {},
      create: { listingId: application.listingId, buyerId: application.applicantId, sellerId },
      select: { id: true },
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.financeApplication.update({
        where: { id: applicationId },
        data: {
          status: dto.status,
          sellerNote: note,
          approvedAmount,
          approvedRate,
          approvedTenure,
          decidedAt: dto.status === FinanceDecisionDto.UNDER_REVIEW ? null : new Date(),
        },
        select: applicationSelect,
      }),
      this.prisma.message.create({ data: { conversationId: conversation.id, senderId: sellerId, content } }),
      this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
      this.prisma.notification.create({
        data: {
          userId: application.applicantId,
          type: 'FINANCE_DECISION',
          title: approved ? 'Application approved' : dto.status === FinanceDecisionDto.REJECTED ? 'Application not approved' : 'Application under review',
          body: `${shopName} updated your application for ${application.product.name}. Open the chat for details.`,
          listingId: application.listingId,
          financeApplicationId: applicationId,
        },
      }),
    ]);

    return { ...updated, conversationId: conversation.id };
  }
}
