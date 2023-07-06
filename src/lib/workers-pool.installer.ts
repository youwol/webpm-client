import { setup } from '../auto-generated'
import * as cdnClient from '.'
import { backendConfiguration } from '.'

export type WorkersModule = typeof import('./workers-pool')
export type TestUtilsModule = typeof import('./test-utils')

function setupWorkersPoolModule(module: WorkersModule) {
    let config = {
        ...cdnClient.Client.BackendConfiguration,
    }
    if (config.origin == '') {
        /**
         * In worker, it is not possible to use relative URL for request => we make it explicit here
         * from the window's location.
         * This is only when the cdnClient lib is used with 'standard' configuration.
         */
        config = backendConfiguration({
            pathLoadingGraph: config.urlLoadingGraph,
            pathResource: config.urlResource,
            origin:
                window.location.origin != 'null'
                    ? window.location.origin
                    : window.location.ancestorOrigins[0],
        })
    }
    module.WorkersPool.BackendConfiguration = config
    module.WorkersPool.FrontendConfiguration =
        cdnClient.Client.FrontendConfiguration
}
// noinspection JSValidateJSDoc
/**
 * Install {@link WorkersPoolModule}.
 *
 * @category WorkersPool
 */
export async function installWorkersPoolModule(): Promise<WorkersModule> {
    return await setup
        .installAuxiliaryModule({
            name: 'workersPool',
            cdnClient,
            installParameters: {
                executingWindow: window,
            },
        })
        .then((module: WorkersModule) => {
            setupWorkersPoolModule(module)
            return module
        })
}
