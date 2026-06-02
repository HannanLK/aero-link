"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const terminus_1 = require("@nestjs/terminus");
const common_middleware_1 = require("@aerolink/common-middleware");
const prisma_module_1 = require("./prisma/prisma.module");
const redis_module_1 = require("./redis/redis.module");
const kafka_module_1 = require("./kafka/kafka.module");
const flights_module_1 = require("./flights/flights.module");
const seats_module_1 = require("./seats/seats.module");
const health_module_1 = require("./health/health.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(common_middleware_1.CorrelationIdMiddleware).forRoutes({ path: '*', method: common_1.RequestMethod.ALL });
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            terminus_1.TerminusModule,
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            kafka_module_1.KafkaModule,
            flights_module_1.FlightsModule,
            seats_module_1.SeatsModule,
            health_module_1.HealthModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map