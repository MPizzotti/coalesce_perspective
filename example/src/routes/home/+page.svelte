<script lang="ts">
    import type * as pspViewer from '@perspective-dev/viewer';
    import { getOrCreateDataFrameStore3 } from "$lib/perspective/dataFrame";
    import '@perspective-dev/viewer/dist/css/themes.css';

    const response = fetch("https://cdn.jsdelivr.net/npm/superstore-arrow/superstore.lz4.arrow");
    const df = getOrCreateDataFrameStore3({
        "name": 'test',
        "data": response
    })

    const loadDataFrame = (element: pspViewer.HTMLPerspectiveViewerElement) => {
        const asyncFN = async () => {
            await element.load(df);
            await element.restore({})
        };
        asyncFN();
        return () => {
            console.log('cleaning up');
        };
    };
</script>
<div class="w-screen h-screen bg-red-500">
    <perspective-viewer class="w-full h-full" {@attach loadDataFrame} theme="Pro Light"></perspective-viewer>
</div>