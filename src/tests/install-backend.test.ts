import { firstValueFrom, lastValueFrom, Observable } from 'rxjs'
import { cleanDocument, installPackages$ } from './common'
import { StateImplementation } from '../lib/state'
import { install } from '../lib'

jest.setTimeout(30 * 1000)
beforeAll(async () => {
    await lastValueFrom(
        installPackages$([
            './.packages-test/demo_yw_backend#0.1.0/cdn.zip',
            // rxjs & http-primitives need to be fetched from CDN when installing backends
            './.packages-test/rxjs#7.5.6/cdn.zip',
            './.packages-test/http-primitives#0.2.4/cdn.zip',
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
        backends: ['demo_yw_backend#^0.1.0 as client'],
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
            channel: (path: string) => Observable<{ [k: string]: unknown }>
        }
    }

    expect(document.scripts).toHaveLength(2) // rxjs & http-primitives
    expect(client).toBeTruthy()
    expect(client.fetch).toBeTruthy()
    expect(client.fromFetch).toBeTruthy()
    expect(client.channel).toBeTruthy()

    const resp = await client.fetch('/hello-world').then((resp) => resp.json())
    expect(resp).toBeTruthy()
    expect(resp.endpoint).toBe('/hello-world')

    const resp2 = await lastValueFrom(client.fromFetch('/hello-world'))
    expect(resp2.status).toBe(200)

    const resp3 = await lastValueFrom(client.fromFetchJson('/hello-world'))
    expect(resp3.endpoint).toBe('/hello-world')

    const resp4 = await firstValueFrom(client.channel('/async-job'))
    expect(resp4.data).toEqual({ result: 'Second 1' })

    const targetEvents = [
        {
            step: 'InstallBackendEvent',
            name: 'demo_yw_backend',
            version: '0.1.0',
            title: 'installing...',
            event: 'started',
            id: 'demo_yw_backend_0-1.0',
            text: 'demo_yw_backend#0.1.0: installing...',
            status: 'Pending',
        },
        {
            step: 'InstallBackendEvent',
            name: 'demo_yw_backend',
            version: '0.1.0',
            title: 'installing...',
            event: 'succeeded',
            id: 'demo_yw_backend_0-1.0',
            text: 'demo_yw_backend#0.1.0: installing...',
            status: 'Pending',
        },
        {
            step: 'StartBackendEvent',
            name: 'demo_yw_backend',
            version: '0.1.0',
            title: 'starting...',
            event: 'starting',
            id: 'demo_yw_backend_0-1.0',
            text: 'demo_yw_backend#0.1.0: starting...',
            status: 'Pending',
        },
        {
            step: 'StartBackendEvent',
            name: 'demo_yw_backend',
            version: '0.1.0',
            title: 'starting...',
            event: 'listening',
            id: 'demo_yw_backend_0-1.0',
            text: 'demo_yw_backend#0.1.0: starting...',
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
