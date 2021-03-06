import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { MemberService } from 'src/member/member.service';
import { AuthService } from './auth.service';
import { CheckEmailDto } from './dto/check-email.request.dto';
import { LoginRequestDto } from './dto/login.request.dto';
import { SignupRequestDto } from './dto/signup.request.dto';
import { JwtRefreshGuard } from './guard/jwt-refresh.guard';
import { JwtAuthGuard } from './guard/jwt.guard';

@Controller('v1/member')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly memberService: MemberService,
  ) {}

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Body() checkEmailDto: CheckEmailDto) {
    const { inputEmail } = checkEmailDto;
    const member = await this.memberService.findByEmail(inputEmail);
    if (member) {
      throw new UnauthorizedException('email was existed already');
    }
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() signupRequestDto: SignupRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const member = await this.authService.register(signupRequestDto);

    const accessToken = this.authService.getJwtAccessToken(member);

    const { refreshToken, key } = await this.authService.getJwtRefreshToken(
      member,
    );

    await this.memberService.setCurrentRefreshToken(
      key,
      String(member.member_id),
    );

    response.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 3600 * 12,
    });

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 3600 * 12,
    });

    return {
      member_id: member.member_id,
      name: member.name,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginRequestDto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { inputEmail, inputPw } = loginRequestDto;

    const member = await this.authService.vaildateMember(inputEmail, inputPw);
    if (!member) {
      throw new UnauthorizedException('???????????? ?????? ??????????????????');
    }

    const accessToken = this.authService.getJwtAccessToken(member);
    const { refreshToken, key } = await this.authService.getJwtRefreshToken(
      member,
    );
    await this.memberService.setCurrentRefreshToken(key, member.member_id);

    response.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 3600 * 12,
    });

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 3600 * 12,
    });

    return {
      member_id: member.member_id,
      name: member.name,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('logout')
  @HttpCode(HttpStatus.ACCEPTED)
  async logOut(@Req() req, @Res({ passthrough: true }) response: Response) {
    await this.memberService.removeRefreshToken(req.user.member_id);
    response.cookie('accessToken', '', {
      httpOnly: true,
      maxAge: 0,
    });

    response.cookie('refreshToken', '', {
      httpOnly: true,
      maxAge: 0,
    });
  }

  @UseGuards(JwtRefreshGuard)
  @Get('refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  refresh(@Req() req, @Res({ passthrough: true }) response: Response) {
    const member = req.user;
    const accessToken = this.authService.getJwtAccessToken(member);
    response.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 3600 * 12,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('check-jwt')
  @HttpCode(HttpStatus.ACCEPTED)
  checkJwt() {
    return true;
  }
}
