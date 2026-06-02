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
var SeatLockConsumer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatLockConsumer = void 0;
const common_1 = require("@nestjs/common");
const kafkajs_1 = require("kafkajs");
const events_1 = require("@aerolink/events");
const seats_service_1 = require("../seats/seats.service");
let SeatLockConsumer = SeatLockConsumer_1 = class SeatLockConsumer {
    config;
    seatsService;
    logger = new common_1.Logger(SeatLockConsumer_1.name);
    consumer;
    constructor(config, seatsService) {
        this.config = config;
        this.seatsService = seatsService;
        const kafka = new kafkajs_1.Kafka({ clientId: this.config.clientId, brokers: this.config.brokers });
        this.consumer = kafka.consumer({ groupId: this.config.groupId });
    }
    async onModuleInit() {
        await this.consumer.connect();
        await this.consumer.subscribe({ topic: events_1.TOPICS.BOOKING_CREATED, fromBeginning: false });
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                const raw = JSON.parse(message.value?.toString() ?? '{}');
                const parsed = events_1.BookingCreatedEventSchema.safeParse(raw);
                if (!parsed.success) {
                    this.logger.warn('Invalid BookingCreated event', parsed.error.message);
                    return;
                }
                const { bookingId, flightId, seatNumber, correlationId } = parsed.data;
                await this.seatsService.lockSeat(flightId, seatNumber, bookingId, correlationId);
            },
        });
    }
    async onModuleDestroy() { await this.consumer.disconnect(); }
};
exports.SeatLockConsumer = SeatLockConsumer;
exports.SeatLockConsumer = SeatLockConsumer = SeatLockConsumer_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('KAFKA_CONFIG')),
    __metadata("design:paramtypes", [Object, seats_service_1.SeatsService])
], SeatLockConsumer);
//# sourceMappingURL=seat-lock.consumer.js.map