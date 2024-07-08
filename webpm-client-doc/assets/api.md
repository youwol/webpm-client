# API Documentation

Welcome to the API documentation for the `{{project}}` project.

Main module of the library, it handles resource installation in the main thread of the browser.


Installation of resources in [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
is handled via the add-on module {@link WorkersPoolModule}.
This add-on module is loaded using {@link installWorkersPoolModule}.
