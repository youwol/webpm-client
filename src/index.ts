// noinspection JSValidateJSDoc

/**
 * The main module of this library is responsible for resource installation within the main thread of the browser,
 * using the {@link install} function.
 *
 * @module MainModule
 */

export * from './lib'
export { setup } from './auto-generated'
import * as cdnClient from './lib'
import { setup } from './auto-generated'

// In a worker, globalThis.document is undefined
//      -> no config initialization here.
//      -> it is propagated when calling 'installWorkersPoolModule'.
// In Node environment (e.g. jest tests) `globalThis.document.currentScript` is undefined
//      -> it has to be set as `Client.BackendConfiguration` static member.
// When this package is installed using another instance of @youwol/webpm-client or @youwol/cdn-client
//      -> 'globalThis.document?.currentScript' is defined, but not the 'src' attribute
//      -> it is the responsibility of the parent installer to propagate the configurations (see
//      {@link applyModuleSideEffects})
if (globalThis.document?.currentScript?.getAttribute('src')) {
    const src = document.currentScript.getAttribute('src')
    const pathConfig = [
        ...src.split('/').slice(0, -1),
        'webpm-client.config.json',
    ].join('/')

    const ywCookie = cdnClient.getLocalYouwolCookie()

    if (ywCookie) {
        cdnClient.Client.BackendConfiguration = cdnClient.backendConfiguration({
            origin: ywCookie.origin,
            ...ywCookie.webpm,
        })
    } else {
        // Using a synchronous request here is on purpose: the objective is to provide a module fully initialized.
        // Using a promise over `backendConfiguration` can be tempting, but:
        // *  promise will propagate and make the API more difficult to use for some functions
        // *  in any practical cases, no installation can start until the following request resolve (so it is like 'frozen')
        // *  the request is usually a couple of 10ms, and is most of the time cached
        const request = new XMLHttpRequest()
        request.open('GET', pathConfig, false) // `false` makes the request synchronous
        request.send(null)
        cdnClient.Client.BackendConfiguration = cdnClient.backendConfiguration(
            JSON.parse(request.responseText),
        )
    }
    const crossOrigin = document.currentScript.getAttribute('crossorigin')
    if (crossOrigin != null) {
        cdnClient.Client.FrontendConfiguration = {
            crossOrigin,
        }
    }
}

if (!globalThis['@youwol/webpm-client']) {
    /**
     * Cdn client is particular: when imported from a `<script>` element its installation has not been managed
     * by the library itself, and the (latest) version exposed with the original library name has not been set.
     * This is why the following line is needed.
     */
    globalThis['@youwol/webpm-client'] = { ...cdnClient, setup }
    /**
     * For the initial install, aliases have to be installed explicitly.
     * They are coming from the file `template.py`, but are for now not available in auto-generated (hence duplication).
     */
    globalThis['webpm'] = globalThis['@youwol/webpm-client']
}
