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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const uuid_1 = require("uuid");
const prisma_service_1 = require("../prisma/prisma.service");
const kafka_service_1 = require("../kafka/kafka.service");
const events_1 = require("@aerolink/events");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    kafka;
    constructor(prisma, jwt, config, kafka) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.kafka = kafka;
    }
    async register(dto, correlationId) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing)
            throw new common_1.ConflictException('Email already registered');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                id: (0, uuid_1.v4)(),
                email: dto.email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
            },
        });
        await this.kafka.emit(events_1.TOPICS.USER_REGISTERED, user.id, (0, events_1.buildUserRegisteredEvent)({
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            correlationId,
        }));
        return { userId: user.id, email: user.email };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user || !user.isActive)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        return this.issueTokens(user.id, user.email, user.roles);
    }
    async refresh(refreshToken) {
        try {
            const payload = this.jwt.verify(refreshToken, {
                secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
            });
            return this.issueTokens(payload.sub, payload.email, payload.roles);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    issueTokens(userId, email, roles) {
        const payload = { sub: userId, email, roles };
        const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
        const refreshToken = this.jwt.sign(payload, {
            secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });
        return { accessToken, refreshToken, expiresIn: 900 };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        kafka_service_1.KafkaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map