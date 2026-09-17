import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartConversationDto {
  @IsUUID()
  listingId: string;
}

// Jobs & Freelancing Cloude: a candidate chats with the recruiter about one job.
// The recruiter can also open the chat themselves by naming the applicant.
export class StartJobConversationDto {
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
