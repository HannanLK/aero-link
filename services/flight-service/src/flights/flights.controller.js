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
exports.FlightsController = void 0;
const common_1 = require("@nestjs/common");
const flights_service_1 = require("./flights.service");
const search_flights_dto_1 = require("./dto/search-flights.dto");
const create_flight_dto_1 = require("./dto/create-flight.dto");
const update_status_dto_1 = require("./dto/update-status.dto");
const common_middleware_1 = require("@aerolink/common-middleware");
let FlightsController = class FlightsController {
    flightsService;
    constructor(flightsService) {
        this.flightsService = flightsService;
    }
    search(dto) {
        return this.flightsService.search(dto);
    }
    create(dto) {
        return this.flightsService.create(dto);
    }
    findOne(id) {
        return this.flightsService.findOne(id);
    }
    updateStatus(id, dto, correlationId) {
        return this.flightsService.updateStatus(id, dto, correlationId);
    }
    getManifest(id) {
        return this.flightsService.getManifest(id);
    }
};
exports.FlightsController = FlightsController;
__decorate([
    (0, common_1.Get)('search'),
    (0, common_middleware_1.Roles)('PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'FLIGHT_OPS', 'ADMIN'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_flights_dto_1.SearchFlightsDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "search", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_middleware_1.Roles)('FLIGHT_OPS', 'ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_flight_dto_1.CreateFlightDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_middleware_1.Roles)('PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'FLIGHT_OPS', 'ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, common_middleware_1.Roles)('FLIGHT_OPS', 'GATE_AGENT', 'ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-correlation-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_status_dto_1.UpdateStatusDto, String]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Get)(':id/manifest'),
    (0, common_middleware_1.Roles)('GATE_AGENT', 'FLIGHT_OPS', 'ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "getManifest", null);
exports.FlightsController = FlightsController = __decorate([
    (0, common_1.Controller)('flights'),
    (0, common_1.UseGuards)(common_middleware_1.RolesGuard),
    __metadata("design:paramtypes", [flights_service_1.FlightsService])
], FlightsController);
//# sourceMappingURL=flights.controller.js.map