export class CreateProviderDto {
  name: string;
  type: 'OIDC' | 'SAML' | 'LDAP';
  config: Record<string, unknown>;
}

export class UpdateProviderDto {
  name?: string;
  config?: Record<string, unknown>;
}

export class CreateGroupMappingDto {
  groupName: string;
  role: string;
}

export class JitProvisionDto {
  providerId: string;
  externalId: string;
  externalEmail?: string;
  externalGroups?: string[];
  givenName?: string;
  familyName?: string;
}

export class SimulateJitDto {
  providerId: string;
  externalId: string;
  externalGroups?: string[];
}
