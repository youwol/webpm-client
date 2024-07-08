# Install

To integrate the webpm client into your project, include it via a `<script>` tag in the `<head>` section of your 
`index.html` file:

```html

<head>
    <script src="https://webpm.org/^3.0.0/webpm-client.js"></script>
</head>
```

This will make the `webpm` variable available globally for resource installation.

For better static analysis in your project:
*  **Install the package:** Add `@youwol/webpm-client` to your `node_modules` (using `npm` or `yarn`).
*  **Configure external dependency:** Link the `webpm` global variable to this package. 
If you are using webpack, configure this by adding an `externals` entry in your `webpack.config.js`:
    ```js
    {
        // ...
        externals: {
            "@youwol/webpm-client": {
                  "root": "webpm"
            }
        } 
    }
    ```