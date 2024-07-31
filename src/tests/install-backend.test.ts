import { firstValueFrom, lastValueFrom, Observable } from 'rxjs'
import { cleanDocument, installPackages$ } from './common'
import { StateImplementation } from '../lib/state'
import { install } from '../lib'

// Timeout has been adapted for testing in CI, 30s is enough in practice for Ubuntu, but not macOS.
jest.setTimeout(60 * 1000)

beforeAll(async () => {
    await lastValueFrom(
        installPackages$([
            './.packages-test/demo_yw_backend#0.1.1/cdn.zip',
            // Following components need to be fetched from CDN when installing backends
            './.packages-test/rxjs#7.5.6/cdn.zip',
            './.packages-test/http-primitives#0.2.4/cdn.zip',
            './.packages-test/uuid#8.3.2/cdn.zip',
        ]),
    )
})
beforeEach(() => {
    cleanDocument()
    StateImplementation.clear()
})
test('install demo_yw_backend', async () => {
    const events = []
    const { client } = (await install({
        backends: ['demo_yw_backend#0.1.1 as client'],
        onEvent: (event) => {
            events.push(event)
        },
    })) as unknown as {
        client: {
            fetch: (path: string) => Promise<Response>
            fromFetch: (path: string) => Observable<Response>
            fromFetchJson: (
                path: string,
            ) => Observable<{ [k: string]: unknown }>
            stream: (path: string) => Observable<{ [k: string]: unknown }>
        }
    }

    expect(document.scripts).toHaveLength(3) // rxjs, http-primitives & uuid
    expect(client).toBeTruthy()
    expect(client.fetch).toBeTruthy()
    expect(client.fromFetch).toBeTruthy()
    expect(client.stream).toBeTruthy()

    const resp = await client.fetch('/hello-world').then((resp) => resp.json())
    expect(resp).toBeTruthy()
    expect(resp.endpoint).toBe('/hello-world')

    const resp2 = await lastValueFrom(client.fromFetch('/hello-world'))
    expect(resp2.status).toBe(200)

    const resp3 = await lastValueFrom(client.fromFetchJson('/hello-world'))
    expect(resp3.endpoint).toBe('/hello-world')

    const resp4 = await firstValueFrom(client.stream('/async-job'))
    expect(resp4.data).toEqual({ result: 'Second 1' })
    const version = '0.1.1'
    const id = 'demo_yw_backend_0-1.1'
    const targetEvents = [
        {
            step: 'InstallBackendEvent',
            name: 'demo_yw_backend',
            version,
            title: 'installing...',
            event: 'started',
            id,
            text: `demo_yw_backend#${version}: installing...`,
            status: 'Pending',
        },
        {
            step: 'InstallBackendEvent',
            name: 'demo_yw_backend',
            version,
            title: 'installing...',
            event: 'succeeded',
            id,
            text: `demo_yw_backend#${version}: installing...`,
            status: 'Pending',
        },
        {
            step: 'StartBackendEvent',
            name: 'demo_yw_backend',
            version,
            title: 'starting...',
            event: 'starting',
            id,
            text: `demo_yw_backend#${version}: starting...`,
            status: 'Pending',
        },
        {
            step: 'StartBackendEvent',
            name: 'demo_yw_backend',
            version,
            title: 'starting...',
            event: 'listening',
            id,
            text: `demo_yw_backend#${version}: starting...`,
            status: 'Pending',
        },
        {
            id: 'InstallDoneEvent',
            step: 'InstallDoneEvent',
            text: 'Installation successful',
            status: 'Succeeded',
        },
    ]
    expect(events).toEqual(targetEvents)
})
