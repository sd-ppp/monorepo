import { AuthenticationClient } from 'authing-js-sdk';
import type { LoginProvider, RegisterParams, LoginParams, SendPassCodeParams } from './AuthService';
import { validatePhoneNumber, formatPhoneNumber, PhoneValidationError } from './phoneUtils';

export class AuthingCNService implements LoginProvider {
  private authing: AuthenticationClient;
  private errorCount = 0;
  private enableQRCode: boolean;

  constructor(private readonly authingAppId: string, options: { enableQRCode?: boolean } = {}) {
    this.authing = new AuthenticationClient({
      appId: authingAppId,
    });
    this.enableQRCode = options.enableQRCode ?? false;
  }

  async intervalCheck(token: string): Promise<{
    loginValid: boolean;
    nextCheckTime: number;
  }> {
    try {
      const userInfo = await this.getUserProfile(token);
      const remoteLastLogin = new Date(userInfo.lastLogin).getTime().toString();
      const localLastLogin = localStorage.getItem('sdppp-authing-lastLogin');
      this.errorCount = 0;
      return { loginValid: remoteLastLogin === localLastLogin, nextCheckTime: 10000 };
    } catch (e) {
      this.errorCount++;
      if (this.errorCount > 3) {
        return { loginValid: false, nextCheckTime: 10000 };
      }
      return { loginValid: true, nextCheckTime: 1000 };
    }
  }

  async validateToken(token: string): Promise<{
    username?: string;
    email?: string;
  }> {
    const result = await this.authing.validateToken({ idToken: token });
    if (!result.data) {
      throw new Error('Invalid token');
    }
    return {
      username: result.data.username || '',
      email: result.data.email || '',
    };
  }

  async register(params: RegisterParams): Promise<void> {
    if ('passwordPayload' in params) {
      if ('username' in params.passwordPayload) {
        await this.authing.registerByUsername(params.passwordPayload.username, params.passwordPayload.password);
      } else if ('email' in params.passwordPayload) {
        await this.authing.registerByEmail(params.passwordPayload.email, params.passwordPayload.password);
      } else if ('phone' in params.passwordPayload) {
        throw new Error('Phone registration by password is not supported');
      }
    } else if ('passcodePayload' in params) {
      if ('phone' in params.passcodePayload) {
        const formattedPhone = formatPhoneNumber(params.passcodePayload.phone);

        if (!validatePhoneNumber(formattedPhone)) {
          throw new PhoneValidationError('Invalid phone number format');
        }

        if (!params.passcodePayload.code || params.passcodePayload.code.trim().length === 0) {
          throw new Error('Verification code is required');
        }

        try {
          await this.authing.registerByPhoneCode(formattedPhone, params.passcodePayload.code.trim());
        } catch (error) {
          throw new Error(
            `Phone registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      } else if ('email' in params.passcodePayload) {
        if (!params.passcodePayload.code || params.passcodePayload.code.trim().length === 0) {
          throw new Error('Verification code is required');
        }

        try {
          await this.authing.registerByEmailCode(params.passcodePayload.email, params.passcodePayload.code.trim());
        } catch (error) {
          throw new Error(
            `Email registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    } else {
      throw new Error('Either passwordPayload or passcodePayload must be provided');
    }
  }

  async login(params: LoginParams): Promise<{
    token: string;
  }> {
    let user: { token?: string };

    if ('passwordPayload' in params) {
      if ('identifier' in params.passwordPayload) {
        const identifier = params.passwordPayload.identifier;
        const password = params.passwordPayload.password;

        let lastError;

        if (/^\\+?\\d+$/.test(identifier)) {
          try {
            user = await this.authing.loginByPhonePassword(identifier, password);
          } catch (error) {
            lastError = error;
            try {
              user = await this.authing.loginByUsername(identifier, password);
            } catch (fallbackError) {
              throw lastError;
            }
          }
        } else if (identifier.includes('@')) {
          try {
            user = await this.authing.loginByEmail(identifier, password);
          } catch (error) {
            lastError = error;
            try {
              user = await this.authing.loginByUsername(identifier, password);
            } catch (fallbackError) {
              throw lastError;
            }
          }
        } else {
          user = await this.authing.loginByUsername(identifier, password);
        }
      } else if ('username' in params.passwordPayload) {
        user = await this.authing.loginByUsername(params.passwordPayload.username, params.passwordPayload.password);
      } else if ('email' in params.passwordPayload) {
        user = await this.authing.loginByEmail(params.passwordPayload.email, params.passwordPayload.password);
      } else if ('phone' in params.passwordPayload) {
        user = await this.authing.loginByUsername(params.passwordPayload.phone, params.passwordPayload.password);
      } else {
        throw new Error('Invalid passwordPayload format');
      }
    } else if (params.passcodePayload) {
      if ('phone' in params.passcodePayload) {
        const formattedPhone = formatPhoneNumber(params.passcodePayload.phone);

        if (!validatePhoneNumber(formattedPhone)) {
          throw new PhoneValidationError('Invalid phone number format');
        }

        if (!params.passcodePayload.code || params.passcodePayload.code.trim().length === 0) {
          throw new Error('Verification code is required');
        }

        try {
          user = await this.authing.loginByPhoneCode(formattedPhone, params.passcodePayload.code.trim());
        } catch (error) {
          throw new Error(`Phone login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if ('email' in params.passcodePayload) {
        if (!params.passcodePayload.code || params.passcodePayload.code.trim().length === 0) {
          throw new Error('Verification code is required');
        }

        try {
          user = await this.authing.loginByEmailCode(params.passcodePayload.email, params.passcodePayload.code.trim());
        } catch (error) {
          throw new Error(`Email login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        throw new Error('Invalid passcodePayload format');
      }
    } else {
      throw new Error('Either passwordPayload or passcodePayload must be provided');
    }

    const token = user.token || '';
    if (token) {
      const userInfo = await this.getUserProfile(token);
      localStorage.setItem('sdppp-authing-lastLogin', new Date(userInfo.lastLogin).getTime().toString());
    }

    return {
      ...user,
      ...{ authingAppId: this.authingAppId },
      token,
    };
  }

  isQRCodeSupported(): boolean {
    return this.enableQRCode;
  }

  async *loginByQRCode(): AsyncGenerator<{
    qrcodeURL: string;
    status: string;
    userInfo?: any;
  }> {
    const { url, random } = await this.authing.wxqrcode.geneCode();
    yield { qrcodeURL: url, status: 'ready' };

    const events: Array<{ status: string; userInfo?: any }> = [];
    let finished = false;

    this.authing.wxqrcode.startPolling(random, {
      onScanned: () => {
        events.push({ status: 'scanned' });
      },
      onResult: (data) => {
        if (data && typeof data === 'object' && 'ticket' in data && data.ticket) {
          this.authing.wxqrcode
            .exchangeUserInfo(data.ticket)
            .then((userInfo) => {
              events.push({
                status: 'success',
                userInfo: { ...userInfo, token: userInfo.token || '' },
              });
              finished = true;
            })
            .catch(() => {
              events.push({ status: 'error' });
              finished = true;
            });
        }
      },
      onCancel: () => {
        events.push({ status: 'cancel' });
        finished = true;
      },
      onExpired: () => {
        events.push({ status: 'expired' });
        finished = true;
      },
      onError: () => {
        events.push({ status: 'error' });
        finished = true;
      },
    });

    while (!finished || events.length > 0) {
      if (events.length > 0) {
        const event = events.shift()!;
        yield { qrcodeURL: url, status: event.status, userInfo: event.userInfo };
        if (
          event.status === 'success' ||
          event.status === 'cancel' ||
          event.status === 'expired' ||
          event.status === 'error'
        ) {
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  isPhoneLoginSupported(): boolean {
    return true;
  }

  async sendPassCode(params: SendPassCodeParams): Promise<void> {
    if (params.phone) {
      const formattedPhone = formatPhoneNumber(params.phone);

      if (!validatePhoneNumber(formattedPhone)) {
        throw new PhoneValidationError('Invalid phone number format');
      }

      try {
        await this.authing.sendSmsCode(formattedPhone);
      } catch (error) {
        throw new Error(`Failed to send SMS code: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (params.email) {
      throw new Error('Email code sending is not supported');
    } else {
      throw new Error('Either phone or email must be provided');
    }
  }

  async getUserProfile(token: string): Promise<{
    username?: string;
    email?: string;
    [key: string]: any;
  }> {
    const response = await fetch('https://api.authing.cn/api/v3/get-profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-authing-app-id': this.authingAppId,
      },
    });
    const result = await response.json();
    if (!result.data) {
      throw new Error('Invalid token');
    }
    return {
      username: result.data.username || '',
      email: result.data.email || '',
      ...result.data,
    };
  }
}
