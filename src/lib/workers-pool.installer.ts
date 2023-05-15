import { setup } from '../auto-generated'
import * as cdnClient from '.'

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
    return await setup.installAuxiliaryModule({
        name: 'workersPool',
        cdnClient: patchedClient,
        installParameters: {
            executingWindow: window,
        },
    })
}
