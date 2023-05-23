import { setup } from '../auto-generated'
import * as cdnClient from '.'
import { backendConfiguration } from '.'

export type WorkersModule = typeof import('./workers-pool')

// noinspection JSValidateJSDoc
/**
 * Install {@link WorkersPoolModule}.
 *
 * @category WorkersPool
 */
export async function installWorkersPoolModule(): Promise<WorkersModule> {
    // this patch is until the youwol's pipeline TS is updated regarding 'installAuxiliaryModule'.
    // see issue: https://tooling.youwol.com/taiga/project/pyyouwol/issue/1137
    const patchedClient = {
        install: (inputs) => cdnClient.install(inputs) as Promise<Window>,
    }
    return await setup
        .installAuxiliaryModule({
            name: 'workersPool',
            cdnClient: patchedClient,
            installParameters: {
                executingWindow: window,
            },
        })
        .then((module: WorkersModule) => {
            /**
             * In worker, it is not possible to use relative URL for request => we make it explicit here
             * from the window's location.
             */
            const originalConfig = cdnClient.Client.BackendConfiguration
            const origin =
                window.location.origin != 'null'
                    ? window.location.origin
                    : window.location.ancestorOrigins[0]
            module.WorkersPool.BackendConfiguration = backendConfiguration({
                id: originalConfig.id,
                pathLoadingGraph: originalConfig.urlLoadingGraph,
                pathRawPackage: originalConfig.urlRawPackage,
                origin,
            })
            return module
        })
}
