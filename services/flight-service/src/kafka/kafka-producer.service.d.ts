import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private producer;
    constructor(config: {
        brokers: string[];
        clientId: string;
    });
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    emit(topic: string, key: string, value: unknown): Promise<void>;
}
//# sourceMappingURL=kafka-producer.service.d.ts.map