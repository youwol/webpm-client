# @youwol/webpm-client

Introducing a dynamic installer and linker for web applications.

The supported resources types are:
*  **ESM modules:** Typically JavaScript or WASM codes running in the front-end.
*  **Pyodide modules:** Python modules running in the browser.
*  **Backends:** Backends modules (services), enabled only for applications running through the py-youwol server,
   running from the user's PC.
*  **Standalone Scripts & CSS**

ESM modules, backends, and standalone scripts & CSS are sourced from the YouWol ecosystem. 
Pyodide resources are obtained from the Pyodide ecosystem.

This application is currently running using webpm; here is the runtime status:


<js-cell cell-id="monitoring">
display(webpm.monitoring().view)
</js-cell>

<cell-output cell-id="monitoring" style="max-height: 33vh" class="overflow-auto border rounded p-1">
</cell-output>


<note level="hint" label="Want to learn more?">
Explore our comprehensive Notebook-based tutorials on the [tutorial pages](@nav/tutorials) 
for in-depth guidance on using webpm.
For technical details, visit the [how-to pages](@nav/how-to), and for API documentation, 
refer to the [API pages](@nav/api).

Curious about the emulated cloud server 'py-youwol'? Learn more [here](@nav/how-to/py-youwol).

</note>
