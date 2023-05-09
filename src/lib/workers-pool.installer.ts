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
    return await setup.installAuxiliaryModule({
        name: 'workersPool',
        cdnClient,
    })
}
