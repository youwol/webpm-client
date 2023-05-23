import { describe } from '@jest/globals'
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

describe('backendConfiguration', () => {
    test.each`
        origin                                                    | expectedOrigin                | title
        ${undefined}                                              | ${''}                         | ${'out origin'}
        ${{}}                                                     | ${'http://localhost:8080'}    | ${' origin {}'}
        ${{ hostname: 'example.com' }}                            | ${'https://example.com'}      | ${' hostname "example.com"'}
        ${{ port: 8888 }}                                         | ${'http://localhost:8888'}    | ${' port 8888'}
        ${{ secure: false }}                                      | ${'http://localhost:8080'}    | ${' secure false'}
        ${{ secure: true }}                                       | ${'https://localhost:8080'}   | ${' secure true'}
        ${{ hostname: 'example.com', port: 8443 }}                | ${'https://example.com:8443'} | ${' hostname "example.com" and port 8443'}
        ${{ hostname: 'example.com', secure: false }}             | ${'http://example.com'}       | ${' hostname "example.com" and secure false'}
        ${{ hostname: 'example.com', secure: true }}              | ${'https://example.com'}      | ${' hostname "example.com" and secure true'}
        ${{ port: 8080, secure: false }}                          | ${'http://localhost:8080'}    | ${' port 8080 and secure false'}
        ${{ port: 8443, secure: true }}                           | ${'https://localhost:8443'}   | ${' port 8443 and secure true'}
        ${{ hostname: 'example.com', port: 8080, secure: false }} | ${'http://example.com:8080'}  | ${' hostname "example.com", port 8080 and secure false'}
        ${{ hostname: 'example.com', port: 8443, secure: true }}  | ${'https://example.com:8443'} | ${' hostname "example.com", port 8443 and secure true'}
    `(
        'with$title has origin "$expectedOrigin"',
        ({ origin, expectedOrigin }) => {
            const params = getParams(origin)

            const subject = backendConfiguration(params)

            expect(subject.origin).toBe(expectedOrigin)
            expect(subject.urlLoadingGraph).toBe(
                expectedOrigin + pathLoadingGraph,
            )
            expect(subject.urlRawPackage).toBe(expectedOrigin + pathRawPackage)
        },
    )
})
