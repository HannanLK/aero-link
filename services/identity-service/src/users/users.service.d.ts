import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(page?: number, limit?: number): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<any>;
    update(id: string, dto: UpdateUserDto, requesterId: string): Promise<any>;
    assignRole(id: string, dto: AssignRoleDto): Promise<any>;
    removeRole(id: string, role: string): Promise<any>;
}
//# sourceMappingURL=users.service.d.ts.map