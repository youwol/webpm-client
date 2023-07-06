import type {
    entryPointWorker,
    IWWorkerProxy,
    WWorkerTrait,
} from '../workers-pool'
import type * as cdnClient from '../workers-pool.installer'

export class WebWorkerJest implements WWorkerTrait {
    public readonly uid: string
    public readonly messages = []
    public readonly globalEntryPoint: typeof entryPointWorker
    onMessageWorker: (message) => unknown
    onMessageMain: (message) => unknown

    constructor(params: {
        uid: string
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
        globalEntryPoint: typeof entryPointWorker
    }) {
        Object.assign(this, params)
    }

    execute({ taskId, entryPoint, args }: { taskId; entryPoint; args }) {
        const message = {
            type: 'Execute',
            data: {
                taskId,
                workerId: this.uid,
                args,
                entryPoint,
            },
        }
        setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- testing workaround
            // @ts-ignore
            this.globalEntryPoint({ data: message })
        }, 0)
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
        setTimeout(() => {
            this.globalEntryPoint({ data: messageToWorker } as MessageEvent)
        }, 0)
    }
    sendBackToMain(message) {
        this.messages.push(message)
        this.onMessageMain({ data: message })
    }
    terminate() {
        /*no op*/
    }
}

export class WebWorkersJest implements IWWorkerProxy {
    static workers = {}
    public readonly globalEntryPoint: typeof entryPointWorker
    constructor(params: {
        globalEntryPoint: typeof entryPointWorker
        cdnClient: typeof cdnClient
    }) {
        Object.assign(this, params)

        globalThis['importScripts'] = () => {
            // this is only called when 'installing' cdnClient in worker
            window['@youwol/cdn-client'] = params.cdnClient
        }

        globalThis['postMessage'] = (message) => {
            //setTimeout because in worker 'postMessage' let the eventLoop to process the next task
            setTimeout(() => {
                const workerId = message.data.workerId
                const worker = WebWorkersJest.workers[workerId]
                worker.sendBackToMain(message)
            }, 0)
        }
    }
    createWorker({
        onMessageWorker,
        onMessageMain,
    }: {
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
    }) {
        const worker = new WebWorkerJest({
            uid: `w${Math.floor(Math.random() * 1e6)}`,
            onMessageWorker,
            onMessageMain,
            globalEntryPoint: this.globalEntryPoint,
        })
        WebWorkersJest.workers[worker.uid] = worker
        return worker
    }

    serializeFunction(fct: (...unknown) => unknown) {
        return fct
    }
}