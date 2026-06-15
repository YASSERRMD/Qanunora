export class CreateIpRestrictionDto {
  ipAddress: string;
  type: 'BLOCK' | 'ALLOW';
  reason?: string;
  expiresAt?: string;
}

export class RecordLoginDto {
  email: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failReason?: string;
}
