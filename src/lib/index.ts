/**
 * This library is used to dynamically fetch dependencies from YouWol's CDN in a front-end application, e.g.:
 *
 * ```typescript
 * await cdn.install({
 *     modules: ['d3', '@youwol/fv-tree'],
 *     css: ['bootstrap#4.4.1~bootstrap.min.css'],
 * })
 * ```
 *
 * Missing dependencies from the provided mapping will be fetched using their latest version.
 *
 * > This client is only dealing with packages stored in the YouWol's CDN: the dependencies
 * > requested, as well as their direct and indirect dependencies, must exist in there.
 *
 * The library can also be used to install stylesheets or javascript addons, see the developer documentation.
 *
 * @module cdn
 */
export * from './client'
export * from './state'
export * from './loader.view'
export * from './models'
export { getAssetId, getUrlBase } from './utils'
