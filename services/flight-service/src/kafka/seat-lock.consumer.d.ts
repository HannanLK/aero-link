import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SeatsService } from '../seats/seats.service';
export declare class SeatLockConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly seatsService;
    private readonly logger;
    private consumer;
    constructor(config: {
        brokers: string[];
        clientId: string;
        groupId: string;
    }, seatsService: SeatsService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
//# sourceMappingURL=seat-lock.consumer.d.ts.map