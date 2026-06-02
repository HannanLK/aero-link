import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtPayload } from '@aerolink/common-middleware';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(page?: number, limit?: number): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<any>;
    update(id: string, dto: UpdateUserDto, user: JwtPayload): Promise<any>;
    assignRole(id: string, dto: AssignRoleDto): Promise<any>;
    removeRole(id: string, role: string): Promise<any>;
}
//# sourceMappingURL=users.controller.d.ts.map