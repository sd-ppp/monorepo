import { app, core } from "photoshop";
import type { Document } from "photoshop/dom/Document";
import type { Layer } from "photoshop/dom/Layer";

export class ModalStateRestorer {
    private callbacks: Array<(success: boolean) => void | Promise<void>> = [];

    public add(fn: (success: boolean) => void | Promise<void>): void {
        this.callbacks.push(fn);
    }

    public async restore(success: boolean): Promise<void> {
        for (const callback of this.callbacks) {
            try {
                await callback(success);
            } catch {
                // Swallow restorer callback errors to continue restoring others.
            }
        }
    }
}

core.setExecutionMode({ enableErrorStacktraces: true });

let modalStatePromise: Promise<unknown> = Promise.resolve();

export async function runNextModalState(
    fn: (restorer: ModalStateRestorer, ...args: any[]) => Promise<any>,
    options: {
        commandName: string;
        document: Document | null;
        dontRecoverSelection?: boolean;
        suspendHistory?: boolean;
    }
): Promise<any> {
    const dontRecoverSelection = options.dontRecoverSelection || false;
    const suspendHistory = options.suspendHistory === undefined ? true : !!options.suspendHistory;

    const restorer = new ModalStateRestorer();
    let anyLayerSelectedChanged = false;
    const activeLayers: Layer[] = [];
    let formerActiveLayersVisible: boolean[] = [];
    const commandName = options.commandName;

    if (!dontRecoverSelection) {
        app.activeDocument.activeLayers.forEach((layer) => activeLayers.push(layer));
        if (options.document && app.activeDocument.id !== options.document.id) {
            options.document.activeLayers.forEach((layer) => activeLayers.push(layer));
        }
        formerActiveLayersVisible = activeLayers.map((layer) => layer.visible);

        restorer.add(() => {
            activeLayers.forEach((formerActiveLayer) => {
                if (!formerActiveLayer.selected) {
                    formerActiveLayer.selected = true;
                    anyLayerSelectedChanged = true;
                }
            });
            if (options.document === app.activeDocument) {
                activeLayers.forEach((formerActiveLayer, index) => {
                    formerActiveLayer.visible = formerActiveLayersVisible[index];
                });
            }
        });
    }

    let suspensionID: any = null;
    let historySuspended = false;
    modalStatePromise = modalStatePromise.catch((e) => e).then(() => {
        return new Promise<void>((resolve) => {
            checkModal();
            function checkModal() {
                if (!core.isModal()) resolve();
                else requestAnimationFrame(checkModal);
            }
        });
    }).then(() => {
        return core.executeAsModal(async (executionContext, ...args: any[]) => {
            if (suspendHistory && options.document) {
                try {
                    suspensionID = await executionContext.hostControl.suspendHistory({
                        documentID: options.document.id,
                        name: commandName
                    });
                    historySuspended = Boolean(suspensionID);
                } catch (error) {
                    suspensionID = null;
                    historySuspended = false;
                }
            } else {
                suspensionID = null;
                historySuspended = false;
            }
            restorer.add(async () => {
                await new Promise(requestAnimationFrame);
                if (!anyLayerSelectedChanged) {
                    if (historySuspended && suspensionID) {
                        try {
                            await executionContext.hostControl.resumeHistory(suspensionID);
                            historySuspended = false;
                            suspensionID = null;
                        } catch (resumeError) {
                            throw resumeError;
                        }
                    }
                }
            });
            try {
                const ret = await fn(restorer, executionContext, ...args);
                await restorer.restore(true);
                return ret;
            } catch (e) {
                await restorer.restore(false);
                throw e;
            }
        }, { commandName: Math.random().toString() });
    });

    let error: unknown = null;
    try {
        await modalStatePromise;
    } catch (e) {
        error = e;
    }

    if (anyLayerSelectedChanged) {
        modalStatePromise = core.executeAsModal(async (executionContext) => {
            activeLayers.forEach((layer, index) => {
                layer.visible = formerActiveLayersVisible[index];
            });
            if (historySuspended && suspensionID) {
                try {
                    await executionContext.hostControl.resumeHistory(suspensionID);
                    historySuspended = false;
                    suspensionID = null;
                } catch (resumeError) {
                    throw resumeError;
                }
            }
        }, {
            commandName,
            interactive: true
        });
        await modalStatePromise;
    }

    if (error) throw error;
    return null;
}
