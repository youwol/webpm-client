export * from '../../lib'
export { setup } from '../../auto-generated'
import * as cdnClient from '../../lib'
import { setup } from '../../auto-generated'

if (!globalThis['@youwol/cdn-client']) {
    /**
     * Cdn client is particular: when imported from a `<scrip>` element its installation has not been managed
     * by the library itself, and the (latest) version exposed with the original library name has not been set.
     * This is why the following line is needed.
     */
    cdnClient.Client.BackendConfiguration = cdnClient.backendConfiguration({
        /*
        To be configured once Webpm backend is in place.
         */
        origin: { hostname: 'platform.youwol.com' },
        pathLoadingGraph:
            '/api/assets-gateway/cdn-backend/queries/loading-graph',
        pathRawPackage: '/api/assets-gateway/raw/package',
    })
    globalThis['@youwol/cdn-client'] = { ...cdnClient, setup }
}
