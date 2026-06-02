import { Controller, Post, Body, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Register a new passenger account. */
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.authService.register(dto, correlationId);
  }

  /** Authenticate and receive an access + refresh token pair. */
  @Post('login')
  @ApiOperation({ summary: 'Log in and obtain JWT tokens' })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Exchange a refresh token for a new access token. */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh an access token' })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Log out (stateless — client discards tokens). */
  @Post('logout')
  @ApiOperation({ summary: 'Log out' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout() {
    // Token invalidation is handled client-side for stateless JWT.
    // For refresh token revocation, add a Redis blacklist in future iterations.
  }
}
