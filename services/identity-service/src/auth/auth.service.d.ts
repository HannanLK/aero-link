import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaService } from '../kafka/kafka.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly kafka;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, kafka: KafkaService);
    register(dto: RegisterDto, correlationId: string): Promise<{
        userId: any;
        email: any;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    private issueTokens;
}
//# sourceMappingURL=auth.service.d.ts.map