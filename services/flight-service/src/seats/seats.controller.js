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
exports.SeatsController = void 0;
const common_1 = require("@nestjs/common");
const seats_service_1 = require("./seats.service");
const common_middleware_1 = require("@aerolink/common-middleware");
let SeatsController = class SeatsController {
    seatsService;
    constructor(seatsService) {
        this.seatsService = seatsService;
    }
    getSeatMap(flightId) {
        return this.seatsService.getSeatMap(flightId);
    }
};
exports.SeatsController = SeatsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_middleware_1.Roles)('PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'FLIGHT_OPS', 'ADMIN'),
    __param(0, (0, common_1.Param)('flightId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SeatsController.prototype, "getSeatMap", null);
exports.SeatsController = SeatsController = __decorate([
    (0, common_1.Controller)('flights/:flightId/seats'),
    (0, common_1.UseGuards)(common_middleware_1.RolesGuard),
    __metadata("design:paramtypes", [seats_service_1.SeatsService])
], SeatsController);
//# sourceMappingURL=seats.controller.js.map