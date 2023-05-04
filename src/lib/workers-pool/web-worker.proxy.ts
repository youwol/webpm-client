export interface WWorkerTrait {
    uid: string
    execute(params: { taskId; entryPoint; args })
    terminate()
}
export interface IWWorkerProxy {
    createWorker({
        onMessageWorker,
        onMessageMain,
    }: {
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
    }): WWorkerTrait
}

export class WebWorkerBrowser implements WWorkerTrait {
    public readonly uid: string
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
    terminate() {
        this.worker.terminate()
    }
}

export class WebWorkersBrowser implements IWWorkerProxy {
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
}
