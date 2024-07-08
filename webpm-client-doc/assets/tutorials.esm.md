# ESM Modules

## Getting Started


To install ECMAScript Modules (ESM), use the [install](@nav/api/MainModule.install) function with the `esm` attribute.
Refer to the [InstallInputs](@nav/api/MainModule.InstallInputs) documentation for more details.

The following cell illustrates the installation of the Bootstrap module along with its CSS stylesheet:

<js-cell>
const { BS } = await webpm.install({
    esm: ['bootstrap#^4.0.0 as BS'],
    css: ['bootstrap#^4.0.0~bootstrap.min.css']
})
display(BS)
</js-cell>

In this example, the latest compatible version of Bootstrap (matching `^4.0.0`) is installed, along with its associated 
CSS (`bootstrap.min.css`). Additionally, all direct and indirect dependencies of Bootstrap are automatically fetched, 
installed, and linked, ensuring they are at the latest versions compatible with the specified queries.

<expandable title="Additional details" icon='fas fa-info-circle' mode="statefull">
<br>

The description of a dependency tree can be retrieved from the
[queryLoadingGraph](@nav/api/MainModule.queryLoadingGraph) function:

<js-cell>
const graph = await webpm.queryLoadingGraph({modules:['bootstrap#^4.0.0']})

graph.lock.forEach((m) => {
    display(new Views.Text(`*  Module \`${m.name}\` at version \`${m.version}\``))
})
</js-cell>

In a <a target="_blank" href="https://getbootstrap.com/docs/4.6/getting-started/download/#jsdelivr"> traditional setup 
</a> with Bootstrap 4 from a CDN, you need to manually include each dependency (Bootstrap, jQuery, 
and Popper.js) in the correct order using `script` tags. This manual process is not only cumbersome—requiring consumers 
to understand Bootstrap’s dependencies and their specific loading sequence—but also non-scalable. 
If a new dependency is introduced in a future release of Bootstrap 4, your application would need to be updated to 
include it.

The webpm client automates this process, handling dependency resolution and loading transparently. 
When new compatible versions of Bootstrap, jQuery, or Popper.js are released, webpm will automatically use them, 
including any additional dependencies, without requiring changes to your application. 
This ensures seamless updates and reduces maintenance overhead.
</expandable>

Regular bootstrap code can now be used:


<js-cell>
let innerHTML = `
<div class="dropdown">
    <button class="btn btn-secondary dropdown-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        Dropdown button
    </button>
    <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
        <a class="dropdown-item">Foo</a>
        <a class="dropdown-item">Bar</a>
        <a class="dropdown-item">Baz</a>
    </div>
</div>`

display({tag:'div', innerHTML})
</js-cell>


The client efficiently manages the installation state to boost performance and minimize the number of modules 
loaded. It ensures that existing compatible versions of modules are reused, reducing redundancy and saving resources.

Consider the following example where bootstrap-select is installed. Since `bootstrap-select` depends on `bootstrap` and
`jquery`, and both are already available in compatible versions, only `bootstrap-select` is installed and linked to the
available `jquery` and `bootstrap` modules:

<js-cell>
const {BSelect} = await webpm.install({
    esm: ['bootstrap-select#^1.13.18 as BSelect'],
    css: ['bootstrap-select#^1.13.18~bootstrap-select.min.css']
})
innerHTML = `
<select class="selectpicker" id="ex-select-picker">
  <option>Foo</option>
  <option>Bar</option>
  <option>Baz</option>
</select>
`

display({tag:'div', innerHTML})
$('.selectpicker').selectpicker();
</js-cell>

<note level='info'>
A package can define 'aliases' that become available upon installation. The symbol `$` used above
is an alias provided when the `jquery` module is installed.
</note>

<note level='hint'>
When resolving dependencies, it is possible that the same package is required with different major versions. 
Webpm handles this scenario effectively by linking each instance of the package according to the specified version
requirements.
</note>


## Advanced Usages

The `esm` attribute can be provided as an object rather than a simple list of modules. 
This allows for additional configuration options during installation. 
For detailed information on the available options, please refer to the 
[API documentation](@nav/api/MainModule.EsmInputs).
