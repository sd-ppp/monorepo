import { useEffect, useRef, useCallback } from "react";

export function BaseDialog({
    show, setShow, children,
    style, className,
}: {
    show: boolean, setShow: (show: boolean) => void, children: React.ReactNode,
    style?: React.CSSProperties,
    className?: string,
}) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (ref.current) {
            show ? ref.current.show() : ref.current.close();
        }
    }, [show]);

    const handleClose = useCallback(() => {
        setShow(false);
    }, [setShow]);

    useEffect(() => {
        if (ref.current) {
            ref.current.addEventListener('close', handleClose);
        }
        return () => {
            if (ref.current) {
                ref.current.removeEventListener('close', handleClose);
            }
        }
    }, [handleClose]);

    return <dialog title="BaseDialog" ref={ref} style={style} className={className} onClick={(e) => {
        e.stopPropagation();
    }}>
        {children}
    </dialog>
}