const { protocol, net } = require('electron');
const fs_sync = require('fs');

class ProtocolHandler {
    static initialize() {
        protocol.handle('app-file', (request) => {
            const urlPathPart = request.url.slice('app-file://'.length);
            const decodedUrlPath = decodeURI(urlPathPart);
            let systemPath;

            if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(decodedUrlPath)) {
                systemPath = decodedUrlPath.substring(1);
            } else if (process.platform !== 'win32' && decodedUrlPath.startsWith('/')) {
                systemPath = decodedUrlPath;
            } else {
                console.error(`[DEBUG Main] Invalid path format for app-file: ${decodedUrlPath}`);
                return new Response(null, { 
                    status: 400, 
                    statusText: 'Invalid path format for app-file protocol.' 
                });
            }

            const fileUrlToFetch = `file:///${systemPath.replace(/\\/g, '/')}`;
            return net.fetch(fileUrlToFetch)
                .catch(err => {
                    console.error(`[DEBUG Main] net.fetch error for ${fileUrlToFetch}:`, err);
                    return new Response(null, { 
                        status: 404, 
                        statusText: `File Not Found or Error Accessing File: ${systemPath}` 
                    });
                });
        });
    }

    static convertFileSrc(filePath) {
        console.log(`[DEBUG Main] IPC 'convert-file-src' called with raw filePath: ${filePath}`);
        
        if (!filePath) {
            console.warn(`[DEBUG Main] convertFileSrc: filePath is null or undefined.`);
            return null;
        }

        if (!fs_sync.existsSync(filePath)) {
            console.warn(`[DEBUG Main] convertFileSrc: File does not exist at path: ${filePath}`);
            return null;
        }

        let normalizedPath = filePath.replace(/\\/g, '/');
        if (process.platform === 'win32' && /^[a-zA-Z]:\//.test(normalizedPath)) {
            normalizedPath = '/' + normalizedPath;
        } else if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }

        const encodedPath = encodeURI(normalizedPath)
            .replace(/#/g, '%23')
            .replace(/\?/g, '%3F');
        const resultUrl = 'app-file://' + encodedPath;
        
        console.log(`[DEBUG Main] Returning URL for convertFileSrc: ${resultUrl}`);
        return resultUrl;
    }
}

module.exports = ProtocolHandler;