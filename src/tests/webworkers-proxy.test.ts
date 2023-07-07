import { WebWorkersBrowser } from '../lib/workers-pool'

const messageWorkers = []
let terminated = false

const onMessageWorker = (m) => {
    messageWorkers.push(m)
}
URL.createObjectURL = (_) => {
    return onMessageWorker.toString()
}
class WorkerMock {
    onMessageWorker
    constructor(onMessageWorker: string) {
        this.onMessageWorker = new Function(
            'messageWorkers',
            `return ${onMessageWorker}`,
        )(messageWorkers)
    }
    onmessage = undefined
    onmessageerror = undefined
    postMessage(m) {
        this.onMessageWorker(m)
    }
    terminate() {
        terminated = true
    }
    addEventListener = undefined
    removeEventListener = undefined
    onerror = undefined
    dispatchEvent = undefined
}
globalThis.Worker = WorkerMock

test('basic behavior using mocks', async () => {
    const wwProxy = new WebWorkersBrowser()
    expect(wwProxy).toBeTruthy()
    const serialized = wwProxy.serializeFunction(() => 42)
    const result = new Function(serialized)()()
    expect(result).toBe(42)
    const worker = wwProxy.createWorker({
        onMessageWorker,
        onMessageMain: () => {
            /*no op*/
        },
    })
    expect(worker).toBeTruthy()
    worker.execute({
        taskId: '1',
        entryPoint: (m) => {
            console.log(m)
        },
        args: {},
    })
    expect(messageWorkers).toHaveLength(1)
    worker.send({ taskId: '1', data: 42 })
    expect(messageWorkers).toHaveLength(2)
    worker.terminate()
    expect(terminated).toBeTruthy()
})
