/*
 * Public API Surface of @youwol/cdn
 */
export * from './lib'

import * as cdnClient from './lib'

if (window['@youwol/cdn-client']) {
    console.warn("Multiple version of '@youwol/cdn-client' have been installed")
}
/**
 * Cdn client is particular: its installation is not managed by the library 'cdn-client' but imported usually with a
 * script element.
 * The versioning logic of possible multiple version available is done below, until there is no new major
 * of cdn-client it should be fine.
 */
if (!window['@youwol/cdn-client']) {
    window['@youwol/cdn-client'] = cdnClient
    window['@youwol/cdn-client_APIv01'] = cdnClient
}
