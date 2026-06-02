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
exports.FlightsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const kafka_producer_service_1 = require("../kafka/kafka-producer.service");
const redis_module_1 = require("../redis/redis.module");
const events_1 = require("@aerolink/events");
const uuid_1 = require("uuid");
let FlightsService = class FlightsService {
    prisma;
    kafka;
    redis;
    constructor(prisma, kafka, redis) {
        this.prisma = prisma;
        this.kafka = kafka;
        this.redis = redis;
    }
    async search(dto) {
        // Read-side: try Redis projection first
        const cacheKey = `flights:search:${dto.origin}:${dto.destination}:${dto.date}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            return { source: 'cache', data: JSON.parse(cached) };
        }
        const from = new Date(dto.date);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dto.date);
        to.setHours(23, 59, 59, 999);
        const flights = await this.prisma.flight.findMany({
            where: {
                origin: dto.origin.toUpperCase(),
                destination: dto.destination.toUpperCase(),
                scheduledDep: { gte: from, lte: to },
                status: { notIn: [client_1.FlightStatus.CANCELLED] },
            },
            include: { aircraft: { select: { model: true } } },
            orderBy: { scheduledDep: 'asc' },
        });
        await this.redis.set(cacheKey, JSON.stringify(flights), 'EX', 60);
        return { source: 'db', data: flights };
    }
    async findOne(id) {
        const flight = await this.prisma.flight.findUnique({
            where: { id },
            include: { aircraft: true },
        });
        if (!flight)
            throw new common_1.NotFoundException(`Flight ${id} not found`);
        return flight;
    }
    async create(dto) {
        return this.prisma.flight.create({
            data: {
                id: (0, uuid_1.v4)(),
                flightNumber: dto.flightNumber,
                origin: dto.origin.toUpperCase(),
                destination: dto.destination.toUpperCase(),
                scheduledDep: new Date(dto.scheduledDep),
                scheduledArr: new Date(dto.scheduledArr),
                aircraftId: dto.aircraftId,
                gate: dto.gate,
                terminal: dto.terminal,
                availableSeats: dto.availableSeats,
            },
        });
    }
    async updateStatus(id, dto, correlationId) {
        const flight = await this.findOne(id);
        const updated = await this.prisma.flight.update({
            where: { id },
            data: { status: dto.status, gate: dto.gate, terminal: dto.terminal },
        });
        await this.kafka.emit(events_1.TOPICS.FLIGHT_STATUS_CHANGED, id, (0, events_1.buildFlightStatusChangedEvent)({
            flightId: id,
            flightNumber: flight.flightNumber,
            previousStatus: flight.status,
            newStatus: dto.status,
            correlationId,
        }));
        // Invalidate search cache for this route
        const dateStr = flight.scheduledDep.toISOString().split('T')[0];
        await this.redis.del(`flights:search:${flight.origin}:${flight.destination}:${dateStr}`);
        return updated;
    }
    async getManifest(id) {
        const flight = await this.prisma.flight.findUnique({
            where: { id },
            include: {
                seats: { where: { isAvailable: false }, select: { seatNumber: true, lockedBy: true } },
            },
        });
        if (!flight)
            throw new common_1.NotFoundException(`Flight ${id} not found`);
        return { flightId: id, bookedSeats: flight.seats };
    }
};
exports.FlightsService = FlightsService;
exports.FlightsService = FlightsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kafka_producer_service_1.KafkaProducerService, Function])
], FlightsService);
//# sourceMappingURL=flights.service.js.map