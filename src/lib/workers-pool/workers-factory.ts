/** @format */

import { BehaviorSubject, forkJoin, Observable, of, Subject } from 'rxjs'
import { filter, last, map, mapTo, take, takeWhile, tap } from 'rxjs/operators'
import {
    CdnEvent,
    getAssetId,
    InstallInputs,
    InstallLoadingGraphInputs,
    isCdnEvent,
} from '..'
import { WorkersPoolView } from './views'
import {
    InWorkerAction,
    IWWorkerProxy,
    WebWorkersBrowser,
    WWorkerTrait,
} from './web-worker.proxy'
import { setup } from '../../auto-generated'
import { BackendConfiguration } from '../backend-configuration'
import { FrontendConfiguration } from '../frontend-configuration'
type WorkerId = string

export interface ContextTrait {
    withChild
    info
}
export class NoContext implements ContextTrait {
    withChild<T>(name: string, cb: (ctx: ContextTrait) => T): T {
        return cb(this)
    }
    info(_text: string) {
        /** no op*/
    }
}

// noinspection JSValidateJSDoc
/**
 * Any {@link MainModule.CdnEvent} emitted from a Worker ({@link WWorkerTrait}).
 * @category Events
 */
export type CdnEventWorker = CdnEvent & {
    workerId: string
}

/**
 * @category Events
 */
export function implementEventWithWorkerTrait(
    event: unknown,
): event is CdnEventWorker {
    return isCdnEvent(event) && (event as CdnEventWorker).workerId != undefined
}

// noinspection JSValidateJSDoc
/**
 * A special type of {@link MessageData} for {@link MainModule.CdnEvent}.
 * @category Worker's Message
 */
export interface MessageCdnEvent {
    type: 'CdnEvent'
    workerId: string
    event: CdnEvent
}

function isCdnEventMessage(message: Message): undefined | CdnEventWorker {
    if (message.type != 'Data') {
        return undefined
    }
    const data = message.data as unknown as MessageCdnEvent
    if (data.type == 'CdnEvent') {
        return { ...data.event, workerId: data.workerId }
    }
    return undefined
}

/**
 * @category Worker Environment
 */
export interface WorkerFunction<T> {
    id: string
    target: T
}

/**
 * @category Worker Environment
 */
export interface WorkerVariable<T> {
    id: string
    value: T
}

/**
 * Task specification.
 *
 * @typeParam TArgs Type of the entry point's arguments
 * @typeParam TReturn Type of the entry point's return
 * (emitted afterward using {@link MessageExit.result | MessageExit.result}).
 */
export interface Task<TArgs = unknown, TReturn = unknown> {
    /**
     * Title of the task.
     */
    title: string
    /**
     * Entry point implementation, the value returned must follow
     * [structured clone algo](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
     * @param args arguments of the entrypoint,  must follow
     * [structured clone algo](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
     */
    entryPoint: (args: TArgs) => TReturn | Promise<TReturn>
    /**
     * Arguments to forward to the entry point upon execution.
     */
    args: TArgs
}

/**
 * @category Worker Environment
 */
export interface WorkerEnvironment {
    /**
     * Global variables accessible in worker environment.
     */
    variables: WorkerVariable<unknown>[]
    /**
     * Global functions  accessible in worker environment.
     */
    functions: WorkerFunction<unknown>[]
    /**
     * Installation instruction to be executed in worker environment.
     */
    cdnInstallation: InstallInputs | InstallLoadingGraphInputs
    /**
     * Tasks to realized after installation is done and before marking a worker as ready.
     */
    postInstallTasks?: Task[]
}

/**
 * Context available in {@link WWorkerTrait} to log info or send data.
 * All data must follow
 * [structured clone algo](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
 * @category Worker Environment
 */
export interface WorkerContext {
    /**
     * The info logged are send from the workers to the main thread as
     * {@link MessageLog}.
     *
     * @param text title of the log
     * @param data data associated.
     */
    info: (text: string, data?: unknown) => void
    /**
     * The data logged are send from the workers to the main thread as
     * {@link MessageData}.
     *
     * @param data data to send.
     */
    sendData: (data: Record<string, unknown>) => void

    /**
     * If defined by the developer in its worker's implementation,
     * every message send using {@link WorkersPool.sendData} will
     * be forwarded to this callback.
     */
    onData?: (message) => void
}

/**
 * Message send from the workers to the main thread when a task is started.
 *
 * @category Worker's Message
 */
export interface MessageExecute {
    /**
     * Id of the task
     */
    taskId: string
    /**
     * Id of the worker
     */
    workerId: string
    /**
     * Serialized entry point
     */
    entryPoint: string
    /**
     * Arguments provided
     */
    args: unknown
}

/**
 * Message emitted from workers when a task is started.
 *
 * @category Worker's Message
 */
export interface MessageStart {
    taskId: string
    workerId: string
}

/**
 * Message emitted from workers when a task is terminated.
 *
 * @category Worker's Message
 */
export interface MessageExit {
    taskId: string
    workerId: string
    error: boolean
    result: unknown
}

/**
 * Message emitted from workers when a log is sent (see {@link WorkerContext}).
 *
 * @category Worker's Message
 */
export interface MessageLog {
    workerId: string
    taskId: string
    text: string
    json: unknown // Json
}

/**
 * Message emitted from workers when a data is sent (see {@link WorkerContext}).
 *
 * @category Worker's Message
 */
export interface MessageData {
    taskId: string
    workerId: string
    [k: string]: unknown
}

/**
 * Message emitted from workers when an error occurred.
 *
 * @category Worker's Message
 */
export interface MessagePostError {
    taskId: string
    workerId: string
    error: Error
}

/**
 * Message send from the main thread to a worker for a particular task.
 * See {@link WorkersPool.sendData}.
 *
 * @category Worker's Message
 */
export interface MainToWorkerMessage {
    /**
     * Id of the task
     */
    taskId: string

    /**
     * Id of the worker
     */
    workerId: string

    /**
     * Data forwarded
     */
    data: unknown
}

/**
 * Messages exchanged between the main thread and the workers' thread.
 *
 * @category Worker's Message
 */
export interface Message {
    type:
        | 'Execute'
        | 'Exit'
        | 'Start'
        | 'Log'
        | 'Data'
        | 'MainToWorkerMessage'
        | 'PostError'
    data:
        | MessageExecute
        | MessageData
        | MessageExit
        | MessageLog
        | MessageStart
        | MainToWorkerMessage
        | MessagePostError
}

/**
 * Encapsulates arguments to be sent to a task's entry point (implementation function).
 *
 * @category Worker Environment
 */
export interface EntryPointArguments<TArgs> {
    args: TArgs
    taskId: string
    workerId: string
    context: WorkerContext
    workerScope
}

/**
 * This function is exposed mostly because it is useful in terms of testing to bypass serialization in string.
 * @category Worker Environment
 */
export function entryPointWorker(messageEvent: MessageEvent) {
    // The following interface avoid the interpreter to interpret self as 'Window':
    // in a worker 'self' is of type DedicatedWorkerGlobalScope.
    // We can get a proper type definition for DedicatedWorkerGlobalScope from typescript:
    //   * add 'webworker' in 'compilerOptions.lib'
    //   * **BUT** typedoc then fails to run, complaining about duplicated declaration.
    // Not sure how to fix this, we keep the documentation working for now using this workaround
    // In TypeScript, the 'Worker' type refers to the global object that represents a web worker.
    // The 'DedicatedWorkerGlobalScope' interface is a subset of the global object that is available to
    // dedicated workers, which are a type of web worker that runs in a single thread.
    interface DedicatedWorkerGlobalScope {
        // message type: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
        postMessage: (message: unknown) => void
    }

    const message: Message = messageEvent.data
    const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope

    // contextByTasks allows to communicate from main to worker after tasks have started execution.
    // In worker's implementation, the developer has to define the property `onMessage` of the received `context`.
    globalThis.contextByTasks = globalThis.contextByTasks || {}
    const contextByTasks = globalThis.contextByTasks

    const postMessage = (message: { type: string; data: unknown }) => {
        try {
            workerScope.postMessage(message)
        } catch (e) {
            console.error(
                `Failed to post message from worker to main thread.`,
                message,
            )
            if (message.type == 'Exit') {
                const data = message.data as MessageExit
                if (contextByTasks[data.taskId]) {
                    delete contextByTasks[data.taskId]
                }
                workerScope.postMessage({
                    type: 'Exit',
                    data: {
                        taskId: data.taskId,
                        workerId: data.workerId,
                        error: true,
                    },
                })
            }
            const data = message.data as MessageData | MessageLog
            workerScope.postMessage({
                type: 'PostError',
                data: {
                    taskId: data.taskId,
                    workerId: data.workerId,
                    error: e,
                },
            })
        }
    }

    if (message.type == 'MainToWorkerMessage') {
        const messageContent: MainToWorkerMessage =
            message.data as unknown as MainToWorkerMessage
        const { taskId, data } = messageContent
        contextByTasks[taskId] &&
            contextByTasks[taskId].onData &&
            contextByTasks[taskId].onData(data)
    }
    // Following is a workaround to allow installing libraries using 'window' instead of 'globalThis' or 'self'.
    workerScope['window'] = globalThis
    if (message.type == 'Execute') {
        const data: MessageExecute = message.data as unknown as MessageExecute
        const context: WorkerContext = {
            info: (text, json) => {
                postMessage({
                    type: 'Log',
                    data: {
                        taskId: data.taskId,
                        workerId: data.workerId,
                        logLevel: 'info',
                        text,
                        json: json,
                    },
                })
            },
            sendData: (consumerData) => {
                postMessage({
                    type: 'Data',
                    data: {
                        ...consumerData,
                        ...{ taskId: data.taskId, workerId: data.workerId },
                    },
                })
            },
        }

        contextByTasks[data.taskId] = context

        const entryPoint =
            // The first branch is to facilitate test environment
            typeof data.entryPoint == 'function'
                ? data.entryPoint
                : new Function(data.entryPoint)()

        postMessage({
            type: 'Start',
            data: {
                taskId: data.taskId,
                workerId: data.workerId,
            },
        })
        try {
            const resultOrPromise = entryPoint({
                args: data.args,
                taskId: data.taskId,
                workerId: data.workerId,
                workerScope: workerScope,
                context,
            })
            if (resultOrPromise instanceof Promise) {
                resultOrPromise
                    .then((result) => {
                        postMessage({
                            type: 'Exit',
                            data: {
                                taskId: data.taskId,
                                workerId: data.workerId,
                                error: false,
                                result: result,
                            },
                        })
                    })
                    .catch((error) => {
                        postMessage({
                            type: 'Exit',
                            data: {
                                taskId: data.taskId,
                                workerId: data.workerId,
                                error: true,
                                result: error,
                            },
                        })
                    })
                return
            }

            postMessage({
                type: 'Exit',
                data: {
                    taskId: data.taskId,
                    workerId: data.workerId,
                    error: false,
                    result: resultOrPromise,
                },
            })
        } catch (e) {
            postMessage({
                type: 'Exit',
                data: {
                    taskId: data.taskId,
                    workerId: data.workerId,
                    error: true,
                    result: e,
                },
            })
            return
        }
    }
}

/**
 * Message sent from the main thread to the workers to request installation of the {@link WorkerEnvironment}.
 *
 * @category Worker's Message
 */
export interface MessageInstall {
    backendConfiguration: BackendConfiguration
    frontendConfiguration: FrontendConfiguration
    cdnUrl: string
    variables: WorkerVariable<unknown>[]
    functions: { id: string; target: string }[]
    cdnInstallation: InstallInputs | InstallLoadingGraphInputs
    postInstallTasks: {
        title: string
        entryPoint: string
        args: unknown
    }[]
    onBeforeInstall: InWorkerAction
    onAfterInstall: InWorkerAction
}

function entryPointInstall(input: EntryPointArguments<MessageInstall>) {
    if (self['@youwol/cdn-client:worker-install-done']) {
        // The environment is already installed
        return Promise.resolve()
    }
    const deserializeFunction = (fct) =>
        typeof fct == 'string' ? new Function(fct)() : fct

    input.args.onBeforeInstall &&
        deserializeFunction(input.args.onBeforeInstall)({
            message: input.args,
            workerScope: input.workerScope,
        })

    /**
     * The function 'importScriptsXMLHttpRequest' is used in place of [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts)
     * when 'FrontendConfiguration.crossOrigin' is "anonymous". Using 'importScripts' fails in this case (request are blocked).
     */
    function importScriptsXMLHttpRequest(...urls: string[]) {
        urls.forEach((url) => {
            const request = new XMLHttpRequest()
            request.open('GET', url, false)
            request.send(null)
            eval(request.responseText)
        })
    }
    self['customImportScripts'] = ['', 'anonymous'].includes(
        input.args.frontendConfiguration.crossOrigin,
    )
        ? importScriptsXMLHttpRequest
        : self['importScripts']
    function isLoadingGraphInstallInputs(
        body: InstallInputs | InstallLoadingGraphInputs,
    ): body is InstallLoadingGraphInputs {
        return (body as InstallLoadingGraphInputs).loadingGraph !== undefined
    }

    console.log('Install environment in worker', input)

    self['customImportScripts'](input.args.cdnUrl)
    const cdn = self['@youwol/cdn-client']
    cdn.Client.BackendConfiguration = input.args.backendConfiguration

    const onEvent = (cdnEvent) => {
        const message = { type: 'CdnEvent', event: cdnEvent }
        input.context.sendData(message)
    }
    input.args.cdnInstallation.onEvent = onEvent
    const customInstallers = input.args.cdnInstallation.customInstallers || []
    customInstallers.map((installer) => {
        installer.installInputs['onEvent'] = onEvent
    })
    const install = isLoadingGraphInstallInputs(input.args.cdnInstallation)
        ? cdn.installLoadingGraph(input.args.cdnInstallation)
        : cdn.install(input.args.cdnInstallation)
    input.context.info('Start install')

    return install
        .then(() => {
            input.args.functions.forEach((f) => {
                self[f.id] = deserializeFunction(f.target)
            })
            self['deserializeFunction'] = deserializeFunction
            input.args.variables.forEach((v) => {
                self[v.id] = v.value
            })
        })
        .then(() => {
            input.context.info('Dependencies installation done')
            const donePromises = input.args.postInstallTasks.map((task) => {
                input.context.info(`Start post-install task '${task.title}'`)
                const entryPoint = new Function(task.entryPoint)()
                const r = entryPoint({
                    args: task.args,
                    context: input.context,
                    taskId: input.taskId,
                    workerScope: input.workerScope,
                })
                return r instanceof Promise ? r : Promise.resolve(r)
            })
            return Promise.all(donePromises)
        })
        .then(() => {
            input.context.info('Post install tasks done')
            input.context.sendData({
                type: 'installEvent',
                value: 'install done',
            })
            input.args.onAfterInstall &&
                deserializeFunction(input.args.onAfterInstall)({
                    message: input.args,
                    workerScope: input.workerScope,
                })
            self['@youwol/cdn-client:worker-install-done'] = true
        })
}

/**
 * A process is an abstraction managing lifecycle of a particular task.
 * Not doing much for now besides gathering callbacks to call at different stage of the task (logging into console).
 */
export class Process {
    /**
     * Task's id.
     */
    public readonly taskId: string
    /**
     * Task's title.
     */
    public readonly title: string
    /**
     * Associated context.
     */
    public readonly context: ContextTrait

    constructor(params: {
        taskId: string
        title: string
        context: ContextTrait
    }) {
        Object.assign(this, params)
    }

    schedule() {
        this.context.info(`Schedule task  ${this.title} (${this.taskId})`)
    }

    start() {
        this.context.info(`Start task  ${this.title} (${this.taskId})`)
    }

    fail(error: unknown) {
        console.error('An error occurred in a worker', error)
        this.context.info(`Task failed  ${this.title} (${this.taskId})`, {
            error,
        })
    }

    succeed() {
        this.context.info(`Task succeeded  ${this.title} (${this.taskId})`)
    }

    log(text: string) {
        this.context.info(`${this.title} (${this.taskId}): ${text}`)
    }
}

/**
 * Pool size specification.
 */
export type PoolSize = {
    /**
     * Initial number of workers to get ready before {@link WorkersPool.ready} is fulfilled.
     * Set to `1` by default.
     */
    startAt?: number
    /**
     * Maximum number of workers.
     * Set to `max(1, navigator.hardwareConcurrency - 1)` by default.
     */
    stretchTo?: number
}
/**
 * Input for {@link WorkersPool.constructor}.
 *
 */
export type WorkersPoolInput = {
    /**
     * If provided, all events regarding installation are forwarded here.
     * Otherwise {@link WorkersPool.cdnEvent$ | WorkersPool.cdnEvent$} is initialized and used.
     */
    cdnEvent$?: Subject<CdnEventWorker>
    /**
     * Globals to be copied in workers' environment.
     */
    globals?: { [_k: string]: unknown }
    /**
     * Installation to proceed in the workers.
     */
    install?: InstallInputs | InstallLoadingGraphInputs
    /**
     * A list of tasks to execute in workers after installation is completed.
     */
    postInstallTasks?: Task[]
    /**
     * A factory that create a `Context` objects used for logging purposes.
     * It serves as dependency injection; the `Context` class from the library
     * [@youwol/logging](https://github.com/youwol/logging) is appropriate for that purpose.
     *
     * @param name name of the root node of the context
     * @return a `Context` object implementing {@link ContextTrait}
     */
    ctxFactory?: (name: string) => ContextTrait

    /**
     * Constraints on the workers pool size.
     */
    pool?: PoolSize
}

/**
 * Input for {@link WorkersPool.schedule}.
 *
 * @typeParam TArgs type of the entry point's argument.
 */
export type ScheduleInput<TArgs> = {
    /**
     * Title of the task
     */
    title: string
    /**
     * Entry point of the task
     */
    entryPoint: (input: EntryPointArguments<TArgs>) => void
    /**
     * Arguments to forward to the entry point when executed
     */
    args: TArgs
    /**
     * If provided, schedule the task on this particular worker.
     */
    targetWorkerId?: string
}
/**
 * Entry point to create workers pool.
 *
 * @category Getting Started
 */
export class WorkersPool {
    static BackendConfiguration: BackendConfiguration
    static FrontendConfiguration: FrontendConfiguration = {}
    static webWorkersProxy: IWWorkerProxy = new WebWorkersBrowser()

    /**
     * Constraints on workers' pool size.
     * @group Immutable Constants
     */
    public readonly pool: PoolSize

    private requestedWorkersCount = 0

    /**
     * All the {@link Message | messages } from all workers.
     *
     * @group Observables
     */
    public readonly mergedChannel$ = new Subject<Message>()
    /**
     * Observable that emit the list of started workers as soon as one or more is starting creation.
     *
     * @group Observables
     */
    public readonly startedWorkers$ = new BehaviorSubject<string[]>([])
    /**
     * Observable that emit a dictionary `workerId -> {worker, channel$}` each time new workers
     * are ready to be used (installation & post-install tasks achieved).
     *
     * The `channel$` object is streaming all associated worker's {@link Message}.
     *
     * @group Observables
     */
    public readonly workers$ = new BehaviorSubject<{
        [p: string]: {
            worker: WWorkerTrait
            channel$: Observable<Message>
        }
    }>({})
    /**
     * Observable that emit the list of running tasks each time one or more are created or stopped.
     *
     * @group Observables
     */
    public readonly runningTasks$ = new BehaviorSubject<
        { workerId: string; taskId: string; title: string }[]
    >([])
    /**
     * Observable that emits the id of workers that are currently running a tasks each time a task is started
     * or stopped.
     *
     * @group Observables
     */
    public readonly busyWorkers$ = new BehaviorSubject<string[]>([])
    /**
     * Observable that emits `{taskId, workerId}` each time a worker finished processing a task.
     *
     * @group Observables
     */
    public readonly workerReleased$ = new Subject<{
        workerId: WorkerId
        taskId: string
    }>()

    /**
     * If `CtxFactory` is provided in constructor's argument ({@link WorkersPoolInput}),
     * main thread logging information is available here.
     */
    public readonly backgroundContext: ContextTrait

    /**
     * Observable that gathers all the {@link CdnEventWorker} emitted by the workers.
     *
     * @group Observables
     */
    public readonly cdnEvent$: Subject<CdnEventWorker>

    /**
     * Workers' environment.
     *
     * @group Immutable Constants
     */
    public readonly environment: WorkerEnvironment

    private tasksQueue: Array<{
        taskId: string
        title: string
        targetWorkerId?: string
        args: unknown
        channel$: Observable<Message>
        entryPoint: (d: EntryPointArguments<unknown>) => unknown
    }> = []

    constructor(params: WorkersPoolInput) {
        if (WorkersPool.BackendConfiguration === undefined) {
            throw new Error(
                'Client.BackendConfiguration not configured and no explicit backendConfiguration param',
            )
        }
        this.backgroundContext =
            params.ctxFactory && params.ctxFactory('background management')
        this.cdnEvent$ = params.cdnEvent$ || new Subject<CdnEventWorker>()
        // Need to manage lifecycle of following subscription
        this.workerReleased$.subscribe(({ workerId, taskId }) => {
            this.busyWorkers$.next(
                this.busyWorkers$.value.filter((wId) => wId != workerId),
            )
            this.runningTasks$.next(
                this.runningTasks$.value.filter(
                    (task) => task.taskId != taskId,
                ),
            )

            this.pickTask(workerId, this.backgroundContext)
        })
        this.environment = {
            variables: Object.entries(params.globals || {})
                .filter(([_, value]) => typeof value != 'function')
                .map(([id, value]) => ({
                    id,
                    value,
                })),
            functions: Object.entries(params.globals || {})
                .filter(([_, value]) => typeof value == 'function')
                .map(([id, target]) => ({
                    id,
                    target,
                })),
            cdnInstallation: params.install,
            postInstallTasks: params.postInstallTasks || [],
        }
        this.pool = {
            startAt: params.pool?.startAt || 0,
            stretchTo:
                params.pool?.stretchTo ||
                Math.max(1, navigator.hardwareConcurrency - 1),
        }
        this.reserve({ workersCount: this.pool.startAt || 0 }).subscribe()
    }

    /**
     * Reserve a particular amount of worker.
     * No workers are deleted, and the number of worker can not exceed `pool.stretchTo` property.
     * @param workersCount
     */
    reserve({ workersCount }: { workersCount: number }) {
        return forkJoin(
            new Array(workersCount)
                .fill(undefined)
                .map(() =>
                    this.createWorker$(this.backgroundContext).pipe(
                        map(({ channel$ }) => channel$),
                    ),
                ),
        )
    }

    /**
     * When this method is awaited, it ensures that `pool.startAt` workers are ready to be used
     * (installation & post-install tasks achieved).
     */
    async ready() {
        return new Promise<void>((resolve) => {
            this.workers$
                .pipe(
                    takeWhile(
                        (workers) =>
                            Object.entries(workers).length < this.pool.startAt,
                    ),
                    last(),
                )
                .subscribe(() => {
                    resolve()
                })
        })
    }

    /**
     * Schedule a task.
     *
     * @param input task description
     * @param context context to log run-time info
     * @typeParam TArgs type of the entry point's argument
     */
    schedule<TArgs = unknown>(
        input: ScheduleInput<TArgs>,
        context = new NoContext(),
    ): Observable<Message> {
        const { title, entryPoint, args, targetWorkerId } = input
        return context.withChild('schedule', (ctx) => {
            const taskId = `t${Math.floor(Math.random() * 1e6)}`
            const p = new Process({
                taskId,
                title,
                context: ctx,
            })
            const taskChannel$ = this.getTaskChannel$(p, taskId, ctx)

            if (targetWorkerId && !this.workers$.value[targetWorkerId]) {
                throw Error('Provided workerId not known')
            }
            if (targetWorkerId && this.workers$.value[targetWorkerId]) {
                ctx.info('Target worker already created, enqueue task')
                p.schedule()
                this.tasksQueue.push({
                    entryPoint,
                    args,
                    taskId,
                    title,
                    channel$: taskChannel$,
                    targetWorkerId,
                })

                if (!this.busyWorkers$.value.includes(targetWorkerId)) {
                    ctx.info('Target worker IDLE, pick task')
                    this.pickTask(targetWorkerId, ctx)
                }

                return taskChannel$
            }
            const worker$ = this.getIdleWorkerOrCreate$(ctx)
            if (!worker$) {
                ctx.info('No worker available & max worker count reached')
                p.schedule()
                this.tasksQueue.push({
                    entryPoint,
                    args,
                    taskId,
                    title,
                    channel$: taskChannel$,
                })
                return taskChannel$
            }
            worker$
                .pipe(
                    map(({ workerId }) => {
                        ctx.info(`Got a worker ready ${workerId}`)
                        p.schedule()
                        this.tasksQueue.push({
                            entryPoint,
                            args,
                            taskId,
                            title,
                            channel$: taskChannel$,
                        })
                        this.pickTask(workerId, ctx)
                        return workerId
                    }),
                )
                .subscribe()

            return taskChannel$
        })
    }

    /**
     * Send a message from main thread to the worker processing a target task.
     * The function running in the worker has to instrument the received `context`
     * argument in order to process the messages.
     * E.g.
     * ```
     * async function functionInWorker({
     *     args,
     *     workerScope,
     *     workerId,
     *     taskId,
     *     context,
     * }){
     *     context.onData = (args) => {
     *         console.log('Received data from main thread', args)
     *     }
     * }
     * ```
     * @param taskId target taskId
     * @param args arguments to forward,
     * should be valid regarding the [structured clone algo](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
     */
    sendData<T>({ taskId, data }: { taskId: string; data: T }) {
        const runningTask = this.runningTasks$.value.find(
            (t) => t.taskId == taskId,
        )
        if (!runningTask) {
            console.error(`WorkersPool.sendMessage: no task #${taskId} running`)
            return
        }
        const worker = this.workers$.value[runningTask.workerId].worker
        worker.send({ taskId, data })
    }

    /**
     * Return the Web Workers proxy.
     */
    getWebWorkersProxy() {
        return WorkersPool.webWorkersProxy
    }

    private getTaskChannel$(
        exposedProcess: Process,
        taskId: string,
        context: ContextTrait = new NoContext(),
    ): Observable<Message> {
        return context.withChild('getTaskChannel$', (ctx) => {
            const channel$ = this.mergedChannel$.pipe(
                filter((message) => message.data.taskId == taskId),
                takeWhile((message) => message.type != 'Exit', true),
            )

            channel$
                .pipe(
                    filter((message) => message.type == 'Start'),
                    take(1),
                )
                .subscribe((message) => {
                    ctx.info(`worker started on task ${taskId}`, message)
                    exposedProcess.start()
                })

            channel$
                .pipe(
                    filter((message) => message.type == 'Exit'),
                    take(1),
                )
                .subscribe((message) => {
                    const data = message.data as unknown as MessageExit
                    if (data.error) {
                        ctx.info(
                            `worker exited abnormally on task ${taskId}`,
                            message,
                        )
                        exposedProcess.fail(data.result)
                        return
                    }
                    exposedProcess.succeed()
                    ctx.info(
                        `worker exited normally on task ${taskId}`,
                        message,
                    )
                })
            channel$
                .pipe(filter((message) => message.type == 'Log'))
                .subscribe((message) => {
                    const data = message.data as unknown as MessageLog
                    exposedProcess.log(data.text)
                    ctx.info(data.text, data.json)
                })

            return channel$
        })
    }

    private getIdleWorkerOrCreate$(
        context: ContextTrait = new NoContext(),
    ): Observable<{
        workerId: string
        worker: Worker
        channel$: Observable<Message>
    }> {
        return context.withChild('getIdleWorkerOrCreate$', (ctx) => {
            const idleWorkerId = Object.keys(this.workers$.value).find(
                (workerId) => !this.busyWorkers$.value.includes(workerId),
            )

            if (idleWorkerId) {
                ctx.info(`return idle worker ${idleWorkerId}`)
                return of({
                    workerId: idleWorkerId,
                    worker: this.workers$.value[idleWorkerId].worker,
                    channel$: this.workers$.value[idleWorkerId].channel$,
                })
            }
            if (this.requestedWorkersCount < this.pool.stretchTo) {
                return this.createWorker$(ctx)
            }
            return undefined
        })
    }

    private createWorker$(context: ContextTrait = new NoContext()): Observable<{
        workerId: string
        worker: Worker
        channel$: Observable<Message>
    }> {
        return context.withChild('createWorker$', (ctx) => {
            this.requestedWorkersCount++
            const workerChannel$ = new Subject<Message>()

            const workerProxy = WorkersPool.webWorkersProxy.createWorker({
                onMessageWorker: entryPointWorker,
                onMessageMain: ({ data }) => {
                    workerChannel$.next(data)
                    this.mergedChannel$.next(data)
                },
            })
            const workerId = workerProxy.uid
            ctx.info(`New raw worker ${workerId} created`)
            this.startedWorkers$.next([...this.startedWorkers$.value, workerId])
            const taskId = `t${Math.floor(Math.random() * 1e6)}`
            const title = 'Install environment'
            const p = new Process({
                taskId,
                title,
                context: ctx,
            })
            const taskChannel$ = this.getTaskChannel$(p, taskId, context)
            const cdnPackage = '@youwol/cdn-client'
            const cdnUrl = `${
                WorkersPool.BackendConfiguration.urlResource
            }/${getAssetId(cdnPackage)}/${setup.version}/dist/${cdnPackage}.js`

            const argsInstall: MessageInstall = {
                backendConfiguration: WorkersPool.BackendConfiguration,
                frontendConfiguration: WorkersPool.FrontendConfiguration,
                cdnUrl: cdnUrl,
                variables: this.environment.variables,
                functions: this.environment.functions.map(
                    ({
                        id,
                        target,
                    }: {
                        id: string
                        target: (...unknown) => unknown
                    }) => ({
                        id,
                        target: WorkersPool.webWorkersProxy.serializeFunction(
                            target,
                        ),
                    }),
                ),
                cdnInstallation: this.environment.cdnInstallation,
                postInstallTasks: this.environment.postInstallTasks.map(
                    (task) => {
                        return {
                            title: task.title,
                            args: task.args,
                            entryPoint: `return ${String(task.entryPoint)}`,
                        }
                    },
                ),
                onBeforeInstall: WorkersPool.webWorkersProxy.serializeFunction(
                    WorkersPool.webWorkersProxy.onBeforeWorkerInstall,
                ),
                onAfterInstall: WorkersPool.webWorkersProxy.serializeFunction(
                    WorkersPool.webWorkersProxy.onAfterWorkerInstall,
                ),
            }

            p.schedule()
            workerProxy.execute({
                taskId,
                entryPoint: entryPointInstall,
                args: argsInstall,
            })

            return workerChannel$.pipe(
                tap((message: Message) => {
                    const cdnEvent = isCdnEventMessage(message)
                    if (cdnEvent) {
                        this.cdnEvent$ && this.cdnEvent$.next(cdnEvent)
                    }
                }),
                filter((message) => message.type == 'Exit'),
                take(1),
                tap(() => {
                    ctx.info(`New worker ready (${workerId}), pick task if any`)
                    this.workers$.next({
                        ...this.workers$.value,
                        [workerId]: {
                            worker: workerProxy,
                            channel$: workerChannel$,
                        },
                    })
                }),
                mapTo({
                    workerId,
                    worker: workerProxy,
                    channel$: taskChannel$,
                }),
            )
        })
    }

    /**
     * Start a worker with first task in its queue
     */
    private pickTask(
        workerId: string,
        context: ContextTrait = new NoContext(),
    ) {
        context.withChild('pickTask', (ctx) => {
            if (this.tasksQueue.length == 0) {
                ctx.info(`No tasks in queue`)
                return
            }
            if (
                this.tasksQueue.filter(
                    (task) =>
                        task.targetWorkerId == undefined ||
                        task.targetWorkerId == workerId,
                ).length == 0
            ) {
                ctx.info(
                    `No tasks in queue match fo target worker (${workerId})`,
                )
                return
            }

            if (this.busyWorkers$.value.includes(workerId)) {
                throw Error(
                    `Can not pick task by ${workerId}: worker already busy. Please report a bug for @youwol/cdn-client.`,
                )
            }
            this.busyWorkers$.next([...this.busyWorkers$.value, workerId])
            const { taskId, title, entryPoint, args, channel$ } =
                this.tasksQueue.find((t) =>
                    t.targetWorkerId ? t.targetWorkerId === workerId : true,
                )
            ctx.info(`Pick task ${taskId} by ${workerId}`)
            this.tasksQueue = this.tasksQueue.filter((t) => t.taskId != taskId)

            this.runningTasks$.next([
                ...this.runningTasks$.value,
                { workerId, taskId, title },
            ])
            const worker = this.workers$.value[workerId].worker

            channel$
                .pipe(
                    filter((message) => {
                        return message.type == 'Exit'
                    }),
                )
                .subscribe((message) => {
                    const exitData = message.data as unknown as MessageExit
                    this.workerReleased$.next({
                        taskId: exitData.taskId,
                        workerId,
                    })
                })
            worker.execute({ taskId, entryPoint, args })
        })
    }

    /**
     * Terminate all the workers.
     */
    terminate() {
        Object.values(this.workers$.value).forEach(({ worker }) =>
            worker.terminate(),
        )
    }

    /**
     * Return a reactive view presenting the workers' state & information.
     */
    view() {
        return new WorkersPoolView({ workersPool: this })
    }
}
