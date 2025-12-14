import { DefaultLoginProvider } from "@sdppp/ps-uxp/src/backend/login/authing/AuthingLoginProvider";
import { LoginParams } from "@sdppp/ps-uxp/src/backend/login/LoginProvider";

export class SDPPPLoginProvider extends DefaultLoginProvider {
    constructor(authingAppId: string) {
        super(authingAppId);
    }

    isQRCodeSupported(): boolean {
        return false;
    }

    async login(params: LoginParams): Promise<{
        token: string;
    }> {
        const user = await super.login(params);
        const userInfo = await this.getUserProfile(user.token);
        localStorage.setItem('sdppp-authing-lastLogin', new Date(userInfo.lastLogin).getTime().toString());
        return user;
    }

    private errorCount = 0;
    async intervalCheck(token: string): Promise<{
        loginValid: boolean;
        nextCheckTime: number;
    }> {
        try {
            const userInfo = await this.getUserProfile(token);
            const remoteLastLogin = new Date(userInfo.lastLogin).getTime().toString()
            const localLastLogin = localStorage.getItem('sdppp-authing-lastLogin')
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
}
