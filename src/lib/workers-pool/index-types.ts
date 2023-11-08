// noinspection JSValidateJSDoc

/**
 * This module export in the {@link MainModule} the types included in the module {@link WorkersPoolModule}
 * (types only, no implementation).
 *
 * It serves as helper when working with typescript, e.g.:
 * ```ts
 * import { installWorkersPoolModule, WorkersType } from '@youwol/webpm-client'
 *
 * async function foo(){
 *      const WPModule = await installWorkersPoolModule()
 *      const pool : WorkersType.WorkersPool = new WPModule.WorkersPool({})
 * }
 * ```
 *
 * See {@link installWorkersPoolModule}.
 *
 * @module WorkersPoolTypes
 */

export type {
    WorkersPool,
    EntryPointArguments,
    WorkerContext,
    WorkerEnvironment,
    WorkerFunction,
    WorkerVariable,
    entryPointWorker,
    CdnEventWorker,
    implementEventWithWorkerTrait,
    Message,
    MessageCdnEvent,
    MessageData,
    MessageExecute,
    MessageExit,
    MessageInstall,
    MessageLog,
    MessageStart,
    CdnEventView,
    WorkerCard,
    WorkerCardTitleView,
    WorkersPoolView,
    WorkersPoolViewState,
    EventData,
    NoContext,
    Process,
    WebWorkerBrowser,
    WebWorkersBrowser,
    ContextTrait,
    IWWorkerProxy,
    Task,
    WWorkerTrait,
    PoolSize,
    ScheduleInput,
    WorkersPoolInput,
} from './index'
