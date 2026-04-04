import { createStore } from "zustand";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { mcpMesh } from "@sdppp/ps-uxp/src/mesh/mesh";
import { AuthingLoginDialogPresentation } from "./AuthingLoginDialogPresentation";

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

function useAuthingLoginStore() {
    return useMemo(() => createStore<AuthingLoginState>(() => ({
        email: "",
        password: "",
        loginError: "",
        loginLoading: false,
    })), []);
}

function useAuthingLoginViewStore() {
    return useMemo(() => createStore<AuthingLoginViewState>(() => ({
        requestingLogin: false,
        isLogin: false,
        isGuest: false,
        userInfo: null,
        balance: null,
    })), []);
}

export function AuthingLoginDialog() {
    const sdkNode = mcpMesh.getNode("sdk");
    const formStore = useAuthingLoginStore();
    const viewStore = useAuthingLoginViewStore();
    const prevRequestingLoginRef = useRef(false);
    const requestingLogin = useStore(
        mcpMesh.store,
        (state) => (state as any).requestingLogin ?? false
    );
    const isLogin = useStore(sdkNode.store, (state) => (state as any).isLogin);
    const isGuest = useStore(sdkNode.store, (state) => (state as any).isGuest);
    const token = useStore(sdkNode.store, (state) => (state as any).token);
    const userInfo = useStore(sdkNode.store, (state) => (state as any).userInfo);
    const balance = useStore(sdkNode.store, (state) => (state as any).balance ?? null);

    useEffect(() => {
        if (isLogin && token && !userInfo) {
            sdkNode.actions.authGetUserProfile({ token }).catch(() => {});
        }
    }, [isLogin, token, userInfo, sdkNode.actions]);

    useEffect(() => {
        if (requestingLogin && !prevRequestingLoginRef.current) {
            sdkNode.actions.fetchBalance?.().catch(() => {});
        }
        prevRequestingLoginRef.current = requestingLogin;
    }, [requestingLogin, sdkNode.actions]);

    useEffect(() => {
        viewStore.setState({
            requestingLogin,
            isLogin,
            isGuest,
            userInfo,
            balance,
        });
    }, [requestingLogin, isLogin, isGuest, userInfo, balance, viewStore]);

    const handleEmailLogin = async () => {
        const { email, password } = formStore.getState();
        if (!email || !password) {
            formStore.setState({ loginError: "请输入邮箱和密码" });
            return;
        }

        formStore.setState({ loginLoading: true, loginError: "" });
        try {
            await sdkNode.actions.authLogin({
                passwordPayload: {
                    email,
                    password,
                }
            } as any);

            mcpMesh.store.setState({ requestingLogin: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : "登录失败";
            formStore.setState({ loginError: message });
        } finally {
            formStore.setState({ loginLoading: false });
        }
    };

    return (
        <AuthingLoginDialogPresentation
            formStore={formStore}
            viewStore={viewStore}
            onClose={() => mcpMesh.store.setState({ requestingLogin: false })}
            onLogout={() => { sdkNode.actions.authLogout({}).catch(() => {}); }}
            onEmailLogin={handleEmailLogin}
        />
    );
}
