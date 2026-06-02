import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import type Redis from 'ioredis';
export declare class SeatsService {
    private readonly prisma;
    private readonly kafka;
    private readonly redis;
    private readonly logger;
    constructor(prisma: PrismaService, kafka: KafkaProducerService, redis: Redis);
    lockSeat(flightId: string, seatNumber: string, bookingId: string, correlationId: string): Promise<void>;
    releaseSeat(flightId: string, seatNumber: string, bookingId: string): Promise<void>;
    getSeatMap(flightId: string): Promise<{
        source: string;
        data: any;
    }>;
}
//# sourceMappingURL=seats.service.d.ts.map