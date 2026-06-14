import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  role: 'VIEWER',
  isActive: true,
  ministryId: null,
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockPrismaService = {
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, def?: unknown) => {
      if (key === 'jwt.refreshExpiresIn') return '7d';
      return def;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateUser', () => {
    it('returns null when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      expect(await service.validateUser('x@x.com', 'pass')).toBeNull();
    });

    it('returns null when password does not match', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
      expect(await service.validateUser(mockUser.email, 'wrong')).toBeNull();
    });

    it('returns user when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      const result = await service.validateUser(mockUser.email, 'correct');
      expect(result).toEqual(mockUser);
    });

    it('returns null when user is inactive', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser, isActive: false });
      expect(await service.validateUser(mockUser.email, 'pass')).toBeNull();
    });
  });

  describe('sanitizeUser', () => {
    it('removes passwordHash from user object', () => {
      const result = service.sanitizeUser(mockUser as never);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('id');
    });
  });
});
