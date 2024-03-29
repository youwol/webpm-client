import { EntryPointArguments } from './workers-factory'

/**
 * Trait for abstracting the concept of Web Worker; default implementation is based on
 * the WebWorker API provided by the browser, see {@link WebWorkerBrowser}.
 */
export interface WWorkerTrait {
    /**
     * Worker's UID
     */
    uid: string

    /**
     *
     * @param params.taskId task Id
     * @param params.entryPoint function to execute
     * @param params.args arguments to provide to the function     *
     */
    execute<T>(params: {
        taskId: string
        entryPoint: (args: EntryPointArguments<T>) => unknown
        args: T
    })

    /**
     * Send to the worker some data in the channel associated to `taskId`
     * @param params.taskId task Id
     * @param params.data arguments to send
     */
    send<T>(params: { taskId: string; data: T })

    terminate()
}

export type InWorkerAction = ({ message, workerScope }) => void
/**
 * Proxy for WebWorkers creation.
 *
 * The default implementation used is the one provided by the browser ({@link WebWorkersBrowser}).
 * Can be also overriden for example for testing contexts.
 */
export interface IWWorkerProxy {
    type: string

    createWorker({
        onMessageWorker,
        onMessageMain,
    }: {
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
    }): WWorkerTrait

    serializeFunction(fct?: (...unknown) => unknown)

    onBeforeWorkerInstall?: InWorkerAction
    onAfterWorkerInstall?: InWorkerAction
}

/**
 * Implementation of {@link WWorkerTrait} for Web Workers provided by browsers.
 */
export class WebWorkerBrowser implements WWorkerTrait {
    /**
     * Immutable Constants
     */
    public readonly uid: string
    /**
     * Immutable Constants
     */
    public readonly worker: Worker

    constructor(params: { uid: string; worker: Worker }) {
        Object.assign(this, params)
    }

    execute({ taskId, entryPoint, args }: { taskId; entryPoint; args }) {
        const message = {
            type: 'Execute',
            data: {
                taskId,
                workerId: this.uid,
                args,
                entryPoint: `return ${String(entryPoint)}`,
            },
        }
        this.worker.postMessage(message)
    }

    send<T>({ taskId, data }: { taskId: string; data: T }) {
        const messageToWorker = {
            type: 'MainToWorkerMessage',
            data: {
                taskId,
                workerId: this.uid,
                data,
            },
        }
        this.worker.postMessage(messageToWorker)
    }

    terminate() {
        this.worker.terminate()
    }
}

export class WebWorkersBrowser implements IWWorkerProxy {
    type = 'WebWorkersBrowser'
    createWorker({
        onMessageWorker,
        onMessageMain,
    }: {
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
    }) {
        const blob = new Blob(
            ['self.onmessage = ', onMessageWorker.toString()],
            {
                type: 'text/javascript',
            },
        )
        const url = URL.createObjectURL(blob)
        const worker = new Worker(url)

        worker.onmessage = onMessageMain
        return new WebWorkerBrowser({
            uid: `w${Math.floor(Math.random() * 1e6)}`,
            worker,
        })
    }

    serializeFunction(fct?: (...unknown) => unknown) {
        return fct ? `return ${String(fct)}` : undefined
    }
}
