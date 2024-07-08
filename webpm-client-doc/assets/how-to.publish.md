# Publish


<note level="warning" label="Important">
Semantic versioning is integral to webpm. Only modules adhering to this standard can be managed through webpm. 
It enables on-the-fly dependency resolution and offers various optimization benefits.
Regardless of webpm, adopting semantic versioning is critical for maintaining compatibility with existing tools and 
systems. 
</note>

## ESM modules

### NPM packages

To install NPM packages (ESM bundles) using webpm, they must be ported to our CDN database.
Given the on-the-fly linking capabilities, it's essential to wrap existing packages appropriately.

Currently, we manage the task of publishing packages. To check if an NPM package is available or to submit a request,
visit this 
<a target='_blank' href='https://platform.youwol.com/applications/@youwol/npm-explorer/latest'>application</a>.

Once published, these wrapped packages are hosted in the YouWol's
<a target="_blank" href="https://github.com/youwol/cdn-externals">CDN externals</a> GitHub repository.


### Custom packages

You can publish your custom packages directly to YouWol's CDN using the **py-youwol** solution. 
This approach is ideal for ongoing projects, as it allows for the inclusion of the current state of your projects 
in the dependency resolution process, seamlessly integrating with other dependencies from the remote database.

Please refer to [this page](@nav/how-to/py-youwol) for an introduction regarding **py-youwol** 
including related documentation links.

## Pyodide modules

For Pyodide modules, we leverage the existing Pyodide ecosystem. 
For more information on how to create and publish Pyodide packages, please refer to the 
<a href="https://pyodide.org/en/stable/development/new-packages.html" target="_blank">Pyodide documentation</a>.


<note level="hint">
When using `py-youwol`, Pyodide runtimes and associated Python modules are cached and organized on the user's PC 
for enhanced performance.
</note>

## Backends

Backends must be built and published using the **py-youwol** solution. 
For more information, please refer to this [page](@nav/how-to/py-youwol).
