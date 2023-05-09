// noinspection JSValidateJSDoc

/**
 * Main module of the library, it handles resources installation in the main thread of the browser.
 *
 * For instance:
 * <iframe id="iFrameExample" src="" width="100%" height="400px"></iframe>
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
 * by default to reach the one provided by YouWol. You can provide other host using the {@link Client} object.
 *
 * ## Resources installation
 *
 * This library takes care of installing modules, scripts, and stylesheets.
 * The generic function {@link install} allows to install the various resources in one call;
 * other more specific functions exist (e.g. {@link installScripts}, {@link installLoadingGraph}, *etc*).
 * When added to the DOM document, modules and scripts are processed by the browser as JavaScript (or WASM) files.
 * Modules may have dependencies, while scripts are self-contained; also, modules are imported before scripts,
 * and stylesheets are imported in parallel.
 *
 * The progress of the installation can be monitored using the various {@link CdnEvent} and {@link CdnError}.
 *
 * A customizable loading screen can be used to display progress of resources installation (see {@link LoadingScreenView}).
 *
 * At any time, the actual state regarding resources installation can be retrieved using the singleton {@link State}.
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

if (window['@youwol/cdn-client']) {
    console.warn("Multiple version of '@youwol/cdn-client' have been installed")
}
/**
 * Cdn client is particular: its installation is not managed by the library 'cdn-client' but imported usually with a
 * script element.
 * The versioning logic of possible multiple versions available is done below, until there is no new major
 * of cdn-client it should be fine.
 */
if (!window['@youwol/cdn-client']) {
    window['@youwol/cdn-client'] = cdnClient
    window[`@youwol/cdn-client_APIv${setup.apiVersion}`] = cdnClient
}
