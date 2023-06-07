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
                    pathRawPackage: config.urlRawPackage,
                    origin:
                        window.location.origin != 'null'
                            ? window.location.origin
                            : window.location.ancestorOrigins[0],
                })
            }
            module.WorkersPool.BackendConfiguration = config
            return module
        })
}
