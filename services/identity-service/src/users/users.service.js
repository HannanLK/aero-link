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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(page = 1, limit = 20) {
        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                skip: (page - 1) * limit,
                take: limit,
                select: { id: true, email: true, firstName: true, lastName: true, roles: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count(),
        ]);
        return { items, total, page, limit };
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, roles: true, createdAt: true },
        });
        if (!user)
            throw new common_1.NotFoundException(`User ${id} not found`);
        return user;
    }
    async update(id, dto, requesterId) {
        if (requesterId !== id)
            throw new common_1.ForbiddenException('Can only update your own profile');
        await this.findOne(id);
        return this.prisma.user.update({
            where: { id },
            data: dto,
            select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        });
    }
    async assignRole(id, dto) {
        const user = await this.findOne(id);
        const roles = Array.from(new Set([...user.roles, dto.role]));
        return this.prisma.user.update({ where: { id }, data: { roles }, select: { id: true, roles: true } });
    }
    async removeRole(id, role) {
        const user = await this.findOne(id);
        const roles = user.roles.filter((r) => r !== role);
        return this.prisma.user.update({ where: { id }, data: { roles }, select: { id: true, roles: true } });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map