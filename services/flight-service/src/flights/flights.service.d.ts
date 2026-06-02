import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import type Redis from 'ioredis';
import { CreateFlightDto } from './dto/create-flight.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
export declare class FlightsService {
    private readonly prisma;
    private readonly kafka;
    private readonly redis;
    constructor(prisma: PrismaService, kafka: KafkaProducerService, redis: Redis);
    search(dto: SearchFlightsDto): Promise<{
        source: string;
        data: any;
    }>;
    findOne(id: string): Promise<any>;
    create(dto: CreateFlightDto): Promise<any>;
    updateStatus(id: string, dto: UpdateStatusDto, correlationId: string): Promise<any>;
    getManifest(id: string): Promise<{
        flightId: string;
        bookedSeats: any;
    }>;
}
//# sourceMappingURL=flights.service.d.ts.map