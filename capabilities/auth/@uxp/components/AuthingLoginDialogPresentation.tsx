import { useStore } from "zustand";
import { BaseDialog } from "./BaseDialog";
import { AuthingQRCode } from "./AuthingQRCode";
import { t } from "@sdppp/common";

type AuthingLoginState = {
    email: string;
    password: string;
    loginError: string;
    loginLoading: boolean;
};

type AuthingLoginViewState = {
    requestingLogin: boolean;
    isLogin: boolean;
    isGuest: boolean;
    userInfo: any;
    balance: number | null;
};

export function AuthingLoginDialogPresentation({
    formStore,
    viewStore,
    onClose,
    onLogout,
    onEmailLogin,
}: {
    formStore: { getState: () => AuthingLoginState; setState: (partial: Partial<AuthingLoginState>) => void };
    viewStore: { getState: () => AuthingLoginViewState; setState: (partial: Partial<AuthingLoginViewState>) => void };
    onClose: () => void;
    onLogout: () => void;
    onEmailLogin: () => void;
}) {
    const email = useStore(formStore as any, (state: AuthingLoginState) => state.email);
    const password = useStore(formStore as any, (state: AuthingLoginState) => state.password);
    const loginError = useStore(formStore as any, (state: AuthingLoginState) => state.loginError);
    const loginLoading = useStore(formStore as any, (state: AuthingLoginState) => state.loginLoading);
    const requestingLogin = useStore(viewStore as any, (state: AuthingLoginViewState) => state.requestingLogin);
    const isLogin = useStore(viewStore as any, (state: AuthingLoginViewState) => state.isLogin);
    const isGuest = useStore(viewStore as any, (state: AuthingLoginViewState) => state.isGuest);
    const userInfo = useStore(viewStore as any, (state: AuthingLoginViewState) => state.userInfo);
    const balance = useStore(viewStore as any, (state: AuthingLoginViewState) => state.balance);
    const balanceText = typeof balance === "number" ? balance.toFixed(2) : "0.00";
    const displayName = userInfo?.displayname
        ?? userInfo?.display_name
        ?? userInfo?.user_metadata?.displayname
        ?? userInfo?.user_metadata?.display_name
        ?? userInfo?.username
        ?? userInfo?.email
        ?? "--";

    return (
        <BaseDialog className="w-[48rem] h-[32rem]" show={requestingLogin} setShow={onClose}>
            {isLogin || isGuest ? (
                <div className="p-6 rounded-lg shadow-lg w-full mx-auto">
                    <div className="text-center mb-6">
                        <h2 style={{ color: "var(--uxp-host-text-color)" }} className="text-2xl font-bold mb-2">
                            {t("auth.login_success")}
                        </h2>
                        <div style={{ color: "var(--uxp-host-text-color-secondary)" }}>
                            {isGuest ? (
                                <p className="mb-1">{t("auth.guest_login_success")}</p>
                            ) : (
                                <p className="mb-1">{t("auth.username_label", { username: displayName })}</p>
                            )}
                            <p className="mb-1">余额: {balanceText}</p>
                            <p className="text-xs">赞助分目前可抵扣SD-PPP内某些第三方api的调用消费。</p>
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={onLogout}
                            style={{
                                backgroundColor: "var(--uxp-host-widget-hover-background-color)",
                                color: "var(--uxp-host-text-color)",
                                border: "1px solid var(--uxp-host-border-color)",
                            }}
                            className="px-6 py-2 rounded-lg transition-colors hover:opacity-80"
                        >
                            {t("auth.logout")}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex h-full w-full gap-6 p-6">
                    <div
                        className="flex w-1/2 flex-col justify-center rounded-lg border p-6"
                        style={{
                            borderColor: "var(--uxp-host-border-color)",
                            backgroundColor: "var(--uxp-host-background-color)",
                        }}
                    >
                        <div className="mb-6 text-center">
                            <h2 style={{ color: "var(--uxp-host-text-color)" }} className="text-xl font-bold mb-2">
                                邮箱登录
                            </h2>
                            <p style={{ color: "var(--uxp-host-text-color-secondary)" }} className="text-sm">
                                使用邮箱和密码登录
                            </p>
                        </div>
                            <sp-textfield
                                label="邮箱"
                                type="email"
                                value={email}
                                placeholder="name@example.com"
                                onInput={(event: any) => formStore.setState({ email: event.currentTarget.value })}
                                class="mb-4 w-full"
                            ></sp-textfield>
                            <sp-textfield
                                label="密码"
                                type="password"
                                value={password}
                                placeholder="请输入密码"
                                onInput={(event: any) => formStore.setState({ password: event.currentTarget.value })}
                                class="mb-4 w-full"
                            ></sp-textfield>
                        {loginError ? (
                            <div className="mb-3 text-sm" style={{ color: "#e76f51" }}>
                                {loginError}
                            </div>
                        ) : null}
                        <sp-action-button
                            onClick={onEmailLogin}
                            class="px-4 py-2 rounded text-sm font-medium w-full"
                            {...(loginLoading ? { disabled: true } : {})}
                        >
                            {loginLoading ? "登录中..." : "登录"}
                        </sp-action-button>
                    </div>
                    <div
                        className="flex w-1/2 items-center justify-center rounded-lg border"
                        style={{
                            borderColor: "var(--uxp-host-border-color)",
                            backgroundColor: "var(--uxp-host-background-color)",
                        }}
                    >
                        <div className="w-full">
                            <AuthingQRCode />
                        </div>
                    </div>
                </div>
            )}
        </BaseDialog>
    );
}
