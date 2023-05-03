import { setup } from '../auto-generated'
import * as cdnClient from '.'

export type WorkersModule = typeof import('./workers-pool')

export async function installWorkersPoolModule(): Promise<WorkersModule> {
    return await setup.installAuxiliaryModule({
        name: 'workersPool',
        cdnClient,
    })
}
