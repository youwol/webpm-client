// noinspection JSValidateJSDoc

/**
 * Main module of the library, it handles resources installation in the main thread of the browser.
 *
 * For instance:
 * <iframe id="iFrameExample" src="" width="100%" height="450px"></iframe>
 * <script>
 *      const src = `
 *   return async ({cdnClient}) => {
 *      const {FV, rx} = await cdnClient.install({
 *          // import modules, they come with their direct and indirect dependencies (e.g. rxjs here).
 *          modules:['@youwol/flux-view#^1.1.0'],
 *          // import css
 *          css: [
 *             '@youwol/fv-widgets#latest~dist/assets/styles/style.youwol.css',
 *          ],
 *          aliases: { FV: '@youwol/flux-view', rx: 'rxjs' }
 *      })
 *      return FV.render({
 *          class: 'fv-text-primary',
 *      	innerText: FV.attr$( rx.timer(0,1000), () => new Date().toLocaleString())
 *      })
 * }
 *  `
 *     const url = '/applications/@youwol/js-playground/latest?content='+encodeURIComponent(src)
 *     document.getElementById('iFrameExample').setAttribute("src",url);
 * </script>
 *
 * Installation of resources in [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
 * is handled via the add-on module {@link WorkersPoolModule}.
 * This add-on module is loaded using {@link installWorkersPoolModule}.
 *
 * # Overall organization
 *
 * ## The backend server
 *
 * Serving the resources & resolving {@link LoadingGraph | loading graphs} is handled by a backend server, configured
 * by default to reach the one provided by YouWol. You can provide other backend's configuration
 * using the {@link backendConfiguration} function.
 *
 * ## Resources installation
 *
 * This library handles the installation of modules, scripts, and stylesheets, with the primary entry point being the
 * generic function {@link install}.
 * Additionally, it offers the capability to pin dependencies, allowing for the exact same state to be restored at
 * a later time using the functions {@link queryLoadingGraph} and {@link installLoadingGraph}.
 *
 * When added to the DOM document, modules and scripts are processed by the browser as JavaScript (or WASM) files.
 * Modules may have dependencies, while scripts are self-contained; also, modules are imported before scripts,
 * and stylesheets are imported in parallel.
 *
 * The progress of the installation can be monitored using the various {@link CdnEvent} and {@link CdnError}.
 *
 * A customizable loading screen can be used to display progress of resources installation (see {@link LoadingScreenView}).
 *
 * At any time, the actual state regarding resources installation can be retrieved using {@link monitoring}.
 *
 * ## Exported symbols
 *
 * Libraries typically provide the names of exported symbols, which can be anything. For example, the exported symbol
 * for lodash is `_`.
 *
 * When using the cdnClient, exported symbol names are harmonized and always follow the
 * pattern `${package}_APIv{apiVersion}`, where:
 * *  `package` is the name of the package, and
 * *  `apiVersion` is the version of the API.
 *
 * The API version is determined by the first non-null integer in the semantic versioning, preceded by any eventual 0
 * of the major and minor version numbers.
 * For instance, if the version number is 2.3.4, the API version is 2.
 * If the version number is 0.1.4, the API version is 01, and if it is 0.0.4, the API version is 004.
 *
 * > Important: when run-times are installed, there can not be multiple libraries installed with same name and
 * same API version. For a given library and API version, the associated element is **the latest version available**
 * among those requested.
 *
 * To ensure compatibility with scenario where the 'original' symbol name is used (such as `_` for lodash),
 * the original symbol used by the libraries is also exported and point to the latest version installed
 * (hence can be mutated if newer versions are installed at some point).
 *
 * ## Version management
 *
 * The versioning system used to query libraries is based on a subset of
 * [npm's semantic versioning](https://docs.npmjs.com/about-semantic-versioning) using either fixed version,
 * the caret `^` (aka hat) symbol, or the `.x` termination.
 *
 * Essentially, this means that installing resources assume **no API breaking changes within a particular API version**
 * defined by `i` in the following scenario:
 *  *  major for patterns like `^i.0.0`
 *  *  minor for patterns like  `^0.i.0`
 *  *  patch for patterns like  `^0.0.i` (equivalent to the fixed version `0.0.i`).
 *
 * ## Custom installers
 *
 * Custom installers for managing other kind of resources can be defined by an external library:
 * this library must export a function with signature `async function install(installInputs)`.
 * For instance a [dedicated installer](https://github.com/youwol/cdn-pyodide-loader) based on the
 * [Pyodide solution](https://pyodide.org/en/stable/) is available.
 * It can be referenced in the {@link install} function like this:
 * ```
 * install({ customInstallers: [{
 *      module: "@youwol/cdn-pyodide-loader#^0.1.2",
 *      installInputs: {
 *          // Pure python wheels from pypi or ported C packages from pyodide can be used
 *          modules: [ "numpy" ],
 *          exportedPyodideInstanceName: "PY",
 *          onEvent: (ev) => message$.next(ev.text),
 *      }}]
 * })
 * ```
 *
 * @module MainModule
 */

export * from './lib'
export { setup } from './auto-generated'
import * as cdnClient from './lib'
import { setup } from './auto-generated'

let config
// In a worker, globalThis.document is undefined -> no config initialization here.
// In this case it is propagated when calling 'installWorkersPoolModule'.
if (globalThis.document) {
    const src = document.currentScript.getAttribute('src')
    const configStandard = cdnClient.backendConfiguration({
        id: 'standard',
        origin: '',
        pathLoadingGraph:
            '/api/assets-gateway/cdn-backend/queries/loading-graph',
        pathRawPackage: '/api/assets-gateway/raw/package',
    })
    // 'assets-gateway-bis' is temporary until the WebPM server is deployed.
    // to simulate it, add to 'backends' in the file 'native_backends.py' in youwol.app.routers:
    //     BackendPlugin(prefix="/api/assets-gateway-bis", tags=["Assets gateway"],
    //     router=assets_gateway.get_router(assets_gtw_config_py_youwol)),
    const configWebPM = cdnClient.backendConfiguration({
        id: 'webPM',
        origin: { secure: false, hostname: 'localhost', port: 2000 },
        pathLoadingGraph:
            '/api/assets-gateway-bis/cdn-backend/queries/loading-graph',
        pathRawPackage: '/api/assets-gateway-bis/raw/package',
    })
    config = src.includes('assets-gateway-bis') ? configWebPM : configStandard
}
cdnClient.Client.BackendConfiguration = config

if (!globalThis['@youwol/cdn-client']) {
    /**
     * Cdn client is particular: when imported from a `<scrip>` element its installation has not been managed
     * by the library itself, and the (latest) version exposed with the original library name has not been set.
     * This is why the following line is needed.
     */
    globalThis['@youwol/cdn-client'] = { ...cdnClient, setup }
}
