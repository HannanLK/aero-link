import { SeatsService } from './seats.service';
export declare class SeatsController {
    private readonly seatsService;
    constructor(seatsService: SeatsService);
    getSeatMap(flightId: string): Promise<{
        source: string;
        data: any;
    }>;
}
//# sourceMappingURL=seats.controller.d.ts.map