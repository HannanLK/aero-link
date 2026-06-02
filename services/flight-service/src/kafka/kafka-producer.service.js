"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaProducerService = void 0;
const common_1 = require("@nestjs/common");
const kafkajs_1 = require("kafkajs");
let KafkaProducerService = class KafkaProducerService {
    config;
    producer;
    constructor(config) {
        this.config = config;
        const kafka = new kafkajs_1.Kafka({ clientId: this.config.clientId, brokers: this.config.brokers });
        this.producer = kafka.producer({ idempotent: true });
    }
    async onModuleInit() { await this.producer.connect(); }
    async onModuleDestroy() { await this.producer.disconnect(); }
    async emit(topic, key, value) {
        await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
    }
};
exports.KafkaProducerService = KafkaProducerService;
exports.KafkaProducerService = KafkaProducerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('KAFKA_CONFIG')),
    __metadata("design:paramtypes", [Object])
], KafkaProducerService);
//# sourceMappingURL=kafka-producer.service.js.map