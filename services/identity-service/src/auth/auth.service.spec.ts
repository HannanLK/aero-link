import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaService } from '../kafka/kafka.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
};

const mockKafka = {
  emit: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: KafkaService, useValue: mockKafka },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and emits a Kafka event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      const result = await service.register(
        { email: 'test@example.com', password: 'Password1!', firstName: 'Jane', lastName: 'Doe' },
        'corr-id-1',
      );

      expect(result.email).toBe('test@example.com');
      expect(mockKafka.emit).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register({ email: 'dupe@test.com', password: 'Password1!', firstName: 'A', lastName: 'B' }, 'x'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@test.com', password: 'pass' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: await bcrypt.hash('correct', 12),
        roles: ['PASSENGER'],
        isActive: true,
      });
      await expect(service.login({ email: 'user@test.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens on successful login', async () => {
      const hash = await bcrypt.hash('correct', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: hash,
        roles: ['PASSENGER'],
        isActive: true,
      });
      const result = await service.login({ email: 'user@test.com', password: 'correct' });
      expect(result.accessToken).toBe('mock-token');
    });
  });
});
