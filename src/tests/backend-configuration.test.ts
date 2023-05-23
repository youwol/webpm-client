import { backendConfiguration } from '../lib/backend-configuration'

const pathLoadingGraph = '/__loading_graph__'
const pathRawPackage = '/__raw_package__'

function getParams(
    origin:
        | { secure?: boolean; hostname?: string; port?: number }
        | string
        | undefined = undefined,
) {
    return { origin, pathRawPackage, pathLoadingGraph }
}

test('without origin', () => {
    // Given
    const params = getParams()

    //
    const subject = backendConfiguration(params)

    //
    expect(subject.origin).toBe('')
    expect(subject.urlLoadingGraph).toBe(pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(pathRawPackage)
})

test('with origin empty object', () => {
    // Given
    const params = getParams({})

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'http://localhost:8080'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with origin string', () => {
    // Given
    const origin = 'https://example.com:1234'
    const params = getParams(origin)

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = origin
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with hostname', () => {
    // Given
    const params = getParams({ hostname: 'example.com' })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'https://example.com'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with port', () => {
    // Given
    const params = getParams({ port: 8888 })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'http://localhost:8888'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with hostname and port', () => {
    // Given
    const params = getParams({ hostname: 'example.com', port: 8443 })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'https://example.com:8443'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with secure true', () => {
    // Given
    const params = getParams({ secure: true })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'https://localhost:8080'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with secure false', () => {
    // Given
    const params = getParams({ secure: false })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'http://localhost:8080'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with hostname and secure true', () => {
    // Given
    const params = getParams({ hostname: 'example.com', secure: true })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'https://example.com'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with hostname and secure false', () => {
    // Given
    const params = getParams({ hostname: 'example.com', secure: false })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'http://example.com'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with port and secure true', () => {
    // Given
    const params = getParams({ port: 8443, secure: true })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'https://localhost:8443'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with port and secure false', () => {
    // Given
    const params = getParams({ port: 8888, secure: false })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'http://localhost:8888'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with hostname, port and secure true', () => {
    // Given
    const params = getParams({
        hostname: 'example.com',
        port: 8443,
        secure: true,
    })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'https://example.com:8443'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})

test('with hostname, port and secure false', () => {
    // Given
    const params = getParams({
        hostname: 'example.com',
        port: 8888,
        secure: false,
    })

    //
    const subject = backendConfiguration(params)

    //
    const expectedOrigin = 'http://example.com:8888'
    expect(subject.origin).toBe(expectedOrigin)
    expect(subject.urlLoadingGraph).toBe(expectedOrigin + pathLoadingGraph)
    expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
})
