
const { entrypoints, storage } = require("uxp");

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _menuItems = Symbol("_menuItems");

class PanelController {
    constructor({ id, menuItems } = {}) {
        this[_id] = null;
        this[_root] = null;
        this[_attachment] = null;
        this[_menuItems] = [];

        this[_id] = id;
        this[_menuItems] = menuItems || [];
        this.menuItems = this[_menuItems].map(menuItem => ({
            id: menuItem.id,
            label: menuItem.label,
            enabled: menuItem.enabled || true,
            checked: menuItem.checked || false
        }));

        ["create", "show", "hide", "destroy", "invokeMenu"].forEach(fn => this[fn] = this[fn].bind(this));
    }

    create() {
        this[_root] = document.getElementById("root");
        // this[_root].style.height = "100vh";
        this[_root].style.overflowY = "hidden";
        this[_root].style.overflowX = "hidden";

        // render entry
        // 渲染入口
        globalThis.sdpppX.__start__(this[_root]);

        return this[_root];
    }

    show(event) {
        if (!this[_root]) this.create();
        this[_attachment] = event;
    }

    hide() {
        if (this[_attachment] && this[_root]) {
            this[_attachment].removeChild(this[_root]);
            this[_attachment] = null;
        }
    }

    destroy() { }

    invokeMenu(id) {
        const menuItem = this[_menuItems].find(c => c.id === id);
        if (menuItem) {
            const handler = menuItem.oninvoke;
            if (handler) {
                handler();
            }
        }
    }
}

entrypoints.setup({
    plugin: {
        create(plugin) {
        },
        destroy() {
        }
    },
    panels: {
        'sd-ppp': new PanelController({
            id: "sd-ppp", menuItems: [
                {
                    id: "sd-ppp-log",
                    label: "查看日志",
                    enabled: true,
                    checked: false,
                    oninvoke: async () => {
                        const logContent = globalThis.sdpppX.__getLogs__().join('\n');
                        
                        // 同时将日志写入文件
                        try {
                            const localFileSystem = storage.localFileSystem;
                            
                            // 获取插件数据文件夹
                            const pluginDataFolder = await localFileSystem.getTemporaryFolder();
                            
                            // 创建日志文件名（带时间戳）
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const logFileName = `sdppp-log-${timestamp}.txt`;
                            
                            // 创建或获取日志文件
                            const logFile = await pluginDataFolder.createFile(`${logFileName}`, { type: "file", overwrite: true});
                            
                            alert(`日志已保存到文件: ${logFile.nativePath}\n\n\n`);

                            // 写入日志内容
                            await logFile.write(logContent, {append: false});
                        } catch (error) {
                            console.error('写入日志文件失败:', error);
                        }
                    }
                }
            ]
        }),
    }
});
