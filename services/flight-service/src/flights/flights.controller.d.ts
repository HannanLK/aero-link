import { FlightsService } from './flights.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
export declare class FlightsController {
    private readonly flightsService;
    constructor(flightsService: FlightsService);
    search(dto: SearchFlightsDto): Promise<{
        source: string;
        data: any;
    }>;
    create(dto: CreateFlightDto): Promise<any>;
    findOne(id: string): Promise<any>;
    updateStatus(id: string, dto: UpdateStatusDto, correlationId: string): Promise<any>;
    getManifest(id: string): Promise<{
        flightId: string;
        bookedSeats: any;
    }>;
}
//# sourceMappingURL=flights.controller.d.ts.map