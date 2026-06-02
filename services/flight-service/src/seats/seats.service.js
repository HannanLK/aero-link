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
var SeatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const kafka_producer_service_1 = require("../kafka/kafka-producer.service");
const redis_module_1 = require("../redis/redis.module");
const events_1 = require("@aerolink/events");
const uuid_1 = require("uuid");
const SEAT_LOCK_TTL_SECONDS = 900; // 15 minutes
let SeatsService = SeatsService_1 = class SeatsService {
    prisma;
    kafka;
    redis;
    logger = new common_1.Logger(SeatsService_1.name);
    constructor(prisma, kafka, redis) {
        this.prisma = prisma;
        this.kafka = kafka;
        this.redis = redis;
    }
    async lockSeat(flightId, seatNumber, bookingId, correlationId) {
        const redisKey = `seat-lock:${flightId}:${seatNumber}`;
        // Atomic SET NX — only one booking wins the lock
        const acquired = await this.redis.set(redisKey, bookingId, 'EX', SEAT_LOCK_TTL_SECONDS, 'NX');
        if (!acquired) {
            this.logger.warn(`Seat ${seatNumber} on flight ${flightId} already locked`);
            await this.kafka.emit(events_1.TOPICS.SEAT_LOCK_FAILED, bookingId, (0, events_1.buildSeatLockFailedEvent)({ bookingId, flightId, seatNumber, reason: 'SEAT_ALREADY_LOCKED', correlationId }));
            return;
        }
        // Persist lock in write-side DB
        await this.prisma.seat.updateMany({
            where: { flightId, seatNumber, isAvailable: true },
            data: { isAvailable: false, lockedBy: bookingId, lockedUntil: new Date(Date.now() + SEAT_LOCK_TTL_SECONDS * 1000) },
        });
        await this.kafka.emit(events_1.TOPICS.SEAT_LOCK_CONFIRMED, bookingId, (0, events_1.buildSeatLockConfirmedEvent)({ eventId: (0, uuid_1.v4)(), bookingId, flightId, seatNumber, correlationId }));
        // Invalidate Redis flight projection cache
        await this.redis.del(`flight:${flightId}:seat-map`);
        this.logger.log(`Seat ${seatNumber} locked for booking ${bookingId}`);
    }
    async releaseSeat(flightId, seatNumber, bookingId) {
        const redisKey = `seat-lock:${flightId}:${seatNumber}`;
        const currentHolder = await this.redis.get(redisKey);
        if (currentHolder === bookingId) {
            await this.redis.del(redisKey);
        }
        await this.prisma.seat.updateMany({
            where: { flightId, seatNumber, lockedBy: bookingId },
            data: { isAvailable: true, lockedBy: null, lockedUntil: null },
        });
        await this.redis.del(`flight:${flightId}:seat-map`);
        this.logger.log(`Seat ${seatNumber} released (booking ${bookingId})`);
    }
    async getSeatMap(flightId) {
        const cacheKey = `flight:${flightId}:seat-map`;
        const cached = await this.redis.get(cacheKey);
        if (cached)
            return { source: 'cache', data: JSON.parse(cached) };
        const seats = await this.prisma.seat.findMany({
            where: { flightId },
            select: { seatNumber: true, class: true, isAvailable: true },
            orderBy: { seatNumber: 'asc' },
        });
        await this.redis.set(cacheKey, JSON.stringify(seats), 'EX', 60);
        return { source: 'db', data: seats };
    }
};
exports.SeatsService = SeatsService;
exports.SeatsService = SeatsService = SeatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kafka_producer_service_1.KafkaProducerService, Function])
], SeatsService);
//# sourceMappingURL=seats.service.js.map