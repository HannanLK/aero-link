"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const auth_service_1 = require("./auth.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const kafka_service_1 = require("../kafka/kafka.service");
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
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
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                { provide: prisma_service_1.PrismaService, useValue: mockPrisma },
                { provide: jwt_1.JwtService, useValue: mockJwt },
                { provide: config_1.ConfigService, useValue: mockConfig },
                { provide: kafka_service_1.KafkaService, useValue: mockKafka },
            ],
        }).compile();
        service = module.get(auth_service_1.AuthService);
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
            const result = await service.register({ email: 'test@example.com', password: 'Password1!', firstName: 'Jane', lastName: 'Doe' }, 'corr-id-1');
            expect(result.email).toBe('test@example.com');
            expect(mockKafka.emit).toHaveBeenCalledTimes(1);
        });
        it('throws ConflictException for duplicate email', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
            await expect(service.register({ email: 'dupe@test.com', password: 'Password1!', firstName: 'A', lastName: 'B' }, 'x')).rejects.toThrow(common_1.ConflictException);
        });
    });
    describe('login', () => {
        it('throws UnauthorizedException for unknown email', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.login({ email: 'nobody@test.com', password: 'pass' })).rejects.toThrow(common_1.UnauthorizedException);
        });
        it('throws UnauthorizedException for wrong password', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 'u1',
                email: 'user@test.com',
                passwordHash: await bcrypt.hash('correct', 12),
                roles: ['PASSENGER'],
                isActive: true,
            });
            await expect(service.login({ email: 'user@test.com', password: 'wrong' })).rejects.toThrow(common_1.UnauthorizedException);
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
//# sourceMappingURL=auth.service.spec.js.map