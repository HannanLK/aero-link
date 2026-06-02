import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class KafkaService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly logger;
    private producer;
    constructor(config: {
        brokers: string[];
        clientId: string;
    });
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    emit(topic: string, key: string, value: unknown): Promise<void>;
}
//# sourceMappingURL=kafka.service.d.ts.map