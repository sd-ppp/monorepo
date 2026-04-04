import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LoginProvider, RegisterParams, LoginParams, SendPassCodeParams } from './AuthService';
import { SUPABASE_CONFIG } from '../supabase/config';

type SDPPPSBServicesOptions = {
  tenantId?: string;
  authingId?: string;
};

export class SDPPPSBServices implements LoginProvider {
  private client: SupabaseClient;
  private tenantId?: string;
  private authingId?: string;
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(options: SDPPPSBServicesOptions = {}) {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
      throw new Error('Supabase config is missing url/anonKey');
    }
    this.tenantId = options.tenantId;
    this.authingId = options.authingId;
    this.supabaseUrl = SUPABASE_CONFIG.url;
    this.supabaseAnonKey = SUPABASE_CONFIG.anonKey;
    this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async intervalCheck(token: string): Promise<{ loginValid: boolean; nextCheckTime: number }> {
    try {
      await this.getUserProfile(token);
      return { loginValid: true, nextCheckTime: 10000 };
    } catch {
      return { loginValid: false, nextCheckTime: 10000 };
    }
  }

  async validateToken(token: string): Promise<{ username?: string; email?: string }> {
    const userInfo = await this.getUserProfile(token);
    return {
      username: userInfo?.user_metadata?.username ?? '',
      email: userInfo?.email ?? '',
    };
  }

  async register(params: RegisterParams): Promise<void> {
    if (!('passwordPayload' in params)) {
      throw new Error('Supabase register only supports passwordPayload');
    }
    if (!('email' in params.passwordPayload)) {
      throw new Error('Supabase register only supports email/password');
    }
    const { error } = await this.client.auth.signUp({
      email: params.passwordPayload.email,
      password: params.passwordPayload.password,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async login(params: LoginParams): Promise<{ token: string; refreshToken?: string | null }> {
    if ('passwordPayload' in params) {
      const payload = params.passwordPayload;
      let email = '';
      if ('email' in payload) {
        email = payload.email;
      } else if ('identifier' in payload) {
        email = payload.identifier;
      } else {
        throw new Error('Supabase login only supports email/identifier');
      }

      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password: payload.password,
      });
      if (error || !data.session?.access_token) {
        throw new Error(error?.message || 'Supabase login failed');
      }
      return {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token ?? null,
      };
    }

    if ('passcodePayload' in params) {
      if ('email' in params.passcodePayload) {
        const { data, error } = await this.client.auth.verifyOtp({
          email: params.passcodePayload.email,
          token: params.passcodePayload.code,
          type: 'email',
        });
        if (error || !data.session?.access_token) {
          throw new Error(error?.message || 'Supabase OTP login failed');
        }
        return {
          token: data.session.access_token,
          refreshToken: data.session.refresh_token ?? null,
        };
      }

      if ('phone' in params.passcodePayload) {
        const { data, error } = await this.client.auth.verifyOtp({
          phone: params.passcodePayload.phone,
          token: params.passcodePayload.code,
          type: 'sms',
        });
        if (error || !data.session?.access_token) {
          throw new Error(error?.message || 'Supabase OTP login failed');
        }
        return {
          token: data.session.access_token,
          refreshToken: data.session.refresh_token ?? null,
        };
      }
    }

    throw new Error('Supabase login only supports passwordPayload or passcodePayload');
  }

  isQRCodeSupported(): boolean {
    return false;
  }

  async *loginByQRCode(): AsyncGenerator<{ qrcodeURL: string; status: string; userInfo?: any }> {
    throw new Error('Supabase QR login is not supported');
  }

  isPhoneLoginSupported(): boolean {
    return true;
  }

  async sendPassCode(_params: SendPassCodeParams): Promise<void> {
    if (_params.email) {
      const { error } = await this.client.auth.signInWithOtp({
        email: _params.email,
      });
      if (error) {
        throw new Error(error.message);
      }
      return;
    }

    if (_params.phone) {
      const { error } = await this.client.auth.signInWithOtp({
        phone: _params.phone,
      });
      if (error) {
        throw new Error(error.message);
      }
      return;
    }

    throw new Error('Supabase passcode login requires email or phone');
  }

  async getUserProfile(token: string): Promise<{ username?: string; email?: string; [key: string]: any }> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) {
      throw new Error(error?.message || 'Invalid token');
    }
    return {
      ...data.user,
      username: (data.user.user_metadata as any)?.username,
      email: data.user.email,
    };
  }

  async logout(): Promise<void> {
    try {
      await this.client.auth.signOut();
    } finally {
      this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }
}
