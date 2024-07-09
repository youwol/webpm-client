# @youwol/webpm-client

Introducing a dynamic installer and linker for browser-based application.

The supported resources types are:
*  **ESM modules:** JavaScript or WASM modules.
*  **Pyodide modules:** Python modules running in the browser.
*  **Backends:** Backends modules (services), enabled only for applications running through the py-youwol server.
*  **Standalone Scripts & CSS**

ESM modules, backends and standalone scripts & CSS are retrieved from the YouWol ecosystem, 
Pyodide resources are retrieved from the Pyodide ecosystem.

To get started, visit the [tutorials page](@nav/tutorials)

Constraints for optimal functionality:
*  **Unbundled ESM Modules:** ESM modules should not include their dependencies bundled.
   While not mandatory, this practice enhances efficiency and prevents issues when dependencies are shared among
   requested modules.
*  **Semantic Versioning:** Use the caret ^ (hat) symbol or .x termination for specifying module dependencies.
   This should be consistently applied both in the modules themselves and within the {@link install} function for ESM
   and backend modules.


<note level="warning" label="Important">
The restriction to using the caret `^` symbol (or the `.x` termination), both of which signify API compatibility
from a specified version, is crucial for enabling dynamic installation in the web browser.

This approach aligns with the recommended use of semantic versioning, ensuring a reliable method for handling
breaking changes.
</note>

**Exported symbols**

Exported symbol names are harmonized and always follow the
pattern `${package}_APIv{apiVersion}`, where:
*  `package` is the name of the package, and
*  `apiVersion` is the version of the API.

The API version is derived from the semantic version number of the package.
It corresponds to the first non-zero integer in the version sequence, preceded by any leading zeroes in the
major and minor version numbers. Examples:
*  For version `2.3.4`, the API version is `2`.
*  For version `0.1.4`, the API version is `01`
*  For version `0.0.4, the API version is `004`.

<note level="warning" label="Important">
There cannot be multiple libraries with the same name and API version installed simultaneously.
For any given library and API version, only the **latest version available** is retained among those requested.
</note>

To support scenarios where the original symbol name is used (e.g., `_` for lodash), the library also exports the
original symbol. This symbol points to the latest installed version and will update if newer versions are installed.
