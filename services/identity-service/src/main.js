"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const common_middleware_1 = require("@aerolink/common-middleware");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({ logger: false }));
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new common_middleware_1.GlobalHttpExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map