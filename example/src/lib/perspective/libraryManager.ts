import { browser } from '$app/environment';
import perspective from '@perspective-dev/client';
import type * as psp from '@perspective-dev/client';

const SERVER_WASM = new URL('@perspective-dev/server/dist/wasm/perspective-server.wasm', import.meta.url).href;
const CLIENT_WASM = new URL('@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm', import.meta.url).href;

class PerspectiveImportManager {
    private static instance: PerspectiveImportManager;
    private perspectiveClient!: psp.Client;
    private perspectiveBootStrapped = false;
    private perspectiveClientBootStrapped = false;

    // Private constructor to prevent external instantiation
    private constructor() {}

    public static getInstance(): PerspectiveImportManager {
        PerspectiveImportManager.instance ??= new PerspectiveImportManager();
        return PerspectiveImportManager.instance;
    }

    public async getPerspectiveClient(): Promise<psp.Client> {
        if (!browser) {
            return this.perspectiveClient;
        }
        if (!this.perspectiveBootStrapped) {
            perspective.init_server(await fetch(SERVER_WASM));
            this.perspectiveBootStrapped = true;
        }
        if (!this.perspectiveClientBootStrapped) {
            const viewer = await import('@perspective-dev/viewer').then(async (perspective_viewer) => {
                await Promise.all([
                    import('@perspective-dev/viewer-datagrid'),
                    import('@perspective-dev/viewer-charts')
                ]);
                await perspective_viewer.init_client(fetch(CLIENT_WASM));
                return perspective_viewer;
            });
        }
        this.perspectiveClient = await perspective.worker();
        this.perspectiveClientBootStrapped = true;
        return this.perspectiveClient;
    }
}
const clientManager = PerspectiveImportManager.getInstance();
export const perspectiveClient = await clientManager.getPerspectiveClient();
