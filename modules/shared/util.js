
const mime = require('mime-types');
const queryString = require('query-string');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

const logger = require('../../lib/winston');
const env = require('../../config/environment');
const wwwPath = path.join(__dirname, `../../${env.WWW_PATH}`);

module.exports = {

    getSocketRemoteAddr: (conn) => {
        return conn.remoteAddress.replace('::ffff:', '');
    },

    handleSocketTimeout: (conn, callback) => {
        conn.setTimeout(80000, () => {
            conn.destroy();
            if (callback)
                callback();
        });

        conn.on('timeout', () => {
            conn.destroy();
            if (callback)
                callback();
        });
    },

    /**
     * parse the data of a request and create a request object
     *
     * the request object's body property should be a string
     *
     * @param requestText {string} The request data as text
     * @returns {Object} A response object like this:
     *  {
     *      "headers": {
     *          "Host": "localhost:9090",
     *          "User-Agent": "curl/7.54.0",
     *          "Accept": "text/html"
     *      },
     *      "method": "GET",
     *      "resource": "/",
     *      "params": {},
     *      "body": ""
     *  }
     */
    parseRequest(requestText) {
        const lines = requestText.split('\r\n');
        const request = {
            headers: {},
            method: '',
            resource: '',
            params: {},
            body: null
        };

        const firstLineParts = lines[0].split(' ');

        // parse method
        request.method = firstLineParts[0];

        // parse resource + params
        if (firstLineParts[1].indexOf('?') >= 0) {
            request.resource = firstLineParts[1].substring(0, firstLineParts[1].indexOf('?'));
            request.params = queryString.parse(firstLineParts[1].substring(firstLineParts[1].indexOf('?')));
        }
        else
            request.resource = firstLineParts[1];

        // parse headers + body
        let isBody = false;
        lines.forEach(line => {
            if (!isBody) {
                const lineParts = line.split(':');
                if (lineParts && lineParts.length > 1) {
                    const headerName = lineParts[0];
                    let headerValue = lineParts[1];

                    // remove leading space
                    if (headerValue.charAt(0) === ' ')
                        headerValue = headerValue.substring(1);

                    // if value part had ':', add the remaining parts
                    for (let i = 2; i < lineParts.length; ++i) {
                        headerValue = headerValue.concat(':', lineParts[i]);
                    }

                    request.headers[headerName] = headerValue;
                }
            }
            else
                request.body = line;

            if (line === "")
                isBody = true;
        });

        return request;
    },

    /**
     * create a response object
     *
     * the response object's body property should be a Buffer
     *
     * @param statusCode {string} The status code. Can be one of the following:
     *  200 OK
     *  404 NOT FOUND
     *  406 NOT ACCEPTABLE
     *  501 NOT IMPLEMENTED
     *
     * @param headers {Object} The response headers
     * @param body {string} The response body (optional)
     * @returns {Object} A response object like this:
     *  {
     *      statusCode: '200 OK',
     *      headers: {
     *          Date: 'Fri, 29 May 2015 13:24:18 GMT',
     *          Server: 'MiServidor/1.0',
     *          Content-Length: '44',
     *          Content-Type: 'text/html'
     *      },
     *      body: '<html><body><h1>¡Hola!</h1></body></html>' (as Buffer)
     *  }
     */
    createResponseObject(statusCode, headers, body) {
        return {
            statusCode,
            headers,
            body
        };
    },

    /**
     * convert a response object to a byte buffer ready for sending as http response
     *
     * @param response {Object}
     * @returns {Buffer}
     */
    responseToBuffer(response) {
        let responseString = 'HTTP/1.1 ';
        responseString = responseString.concat(response.statusCode, '\r\n');

        Object.keys(response.headers).forEach(key => {
            responseString = responseString.concat(`${key}: ${response.headers[key]}`, '\r\n');
        });

        responseString = responseString.concat('\r\n');
        if (response.body)
            return Buffer.concat([Buffer.from(responseString), response.body]);
        else
            return Buffer.from(responseString);
    },

    /**
     * process a request and create a corresponding response
     *
     * @param req {Object} A request object
     * @returns {Object} A response object
     */
    createResponse(req) {
        switch(req.method) {
            case 'GET':
                return this.processGet(req);
            case 'HEAD':
                return this.processHead(req);
            case 'POST':
                return this.processPost(req);
            default:
                return this.create501Response();
        }
    },

    processGet(req) {
        const resourceName = this.getReqResourceName(req);
        const resourcePath = `${wwwPath}/${resourceName}`;
        const resourceExists = fs.existsSync(resourcePath);
        const resourceMimeType = mime.lookup(resourceName);
        const acceptedMimeTypes = this.parseMimeTypeList(req.headers['Accept']);

        // check resource exists
        if (!resourceExists)
            return this.create404Response();
        else {

            // check mime types match
            if (!this.mimeTypeIsAccepted(resourceMimeType, acceptedMimeTypes))
                return this.create406Response();
            else {

                let data = fs.readFileSync(resourcePath);

                // run data through CGI if necessary
                if (req.body && this.mimeTypeIsHtml(mime.lookup(resourceName)))
                    data = this.runCGI(data, this.parseFormUrlEncoded(req.body));

                return this.create200Response(data, resourceMimeType);

            }

        }
    },

    processHead(req) {
        const resourceName = this.getReqResourceName(req);
        const resourcePath = `${wwwPath}/${resourceName}`;
        const resourceExists = fs.existsSync(resourcePath);
        const resourceMimeType = mime.lookup(resourceName);
        const acceptedMimeTypes = this.parseMimeTypeList(req.headers['Accept']);

        // check resource exists
        if (!resourceExists)
            return this.create404Response();
        else {

            // check mime types match
            if (!this.mimeTypeIsAccepted(resourceMimeType, acceptedMimeTypes))
                return this.create406Response();
            else
                return this.create200Response(null, resourceMimeType);     // create response

        }
    },

    processPost(req) {
        const resourceName = this.getReqResourceName(req);
        const resourcePath = `${wwwPath}/${resourceName}`;
        const resourceExists = fs.existsSync(resourcePath);
        const resourceMimeType = mime.lookup(resourceName);
        const acceptedMimeTypes = this.parseMimeTypeList(req.headers['Accept']);

        // check resource exists
        if (!resourceExists)
            return this.create404Response();
        else {

            // check mime types match
            if (!this.mimeTypeIsAccepted(resourceMimeType, acceptedMimeTypes))
                return this.create406Response();
            else {

                let data = fs.readFileSync(resourcePath);

                // run data through CGI if necessary
                if (req.body && this.mimeTypeIsHtml(mime.lookup(resourceName)))
                    data = this.runCGI(data, this.parseFormUrlEncoded(req.body));

                return this.create200Response(data, resourceMimeType);

            }

        }
    },

    create200Response(body, contentType) {
        const response = this.createResponseObject(
            '200 OK',
            {
                'Date': moment().format('ddd, MMMM Do YYYY HH:mm:ss Z'),
                'Server': 'MiServidor/1.0',
                'Content-Length': body ? body.length : 0,
                'Content-Type': contentType
            },
            body
        );

        return response;
    },

    create404Response() {
        const body = fs.readFileSync(`${wwwPath}/404.html`);
        const response = this.createResponseObject(
            '404 NOT FOUND',
            {
                'Date': moment().format('ddd, MMMM Do YYYY HH:mm:ss Z'),
                'Server': 'MiServidor/1.0',
                'Content-Length': body ? body.length : 0,
                'Content-Type': 'text/html'
            },
            body
        );

        return response;
    },

    create406Response() {
        const body = fs.readFileSync(`${wwwPath}/406.html`);
        const response = this.createResponseObject(
            '406 NOT ACCEPTABLE',
            {
                'Date': moment().format('ddd, MMMM Do YYYY HH:mm:ss Z'),
                'Server': 'MiServidor/1.0',
                'Content-Length': body ? body.length : 0,
                'Content-Type': 'text/html'
            },
            body
        );

        return response;
    },

    create501Response() {
        const body = fs.readFileSync(`${wwwPath}/501.html`);
        const response = this.createResponseObject(
            '501 NOT IMPLEMENTED',
            {
                'Date': moment().format('ddd, MMMM Do YYYY HH:mm:ss Z'),
                'Server': 'MiServidor/1.0',
                'Content-Length': body ? body.length : 0,
                'Content-Type': 'text/html'
            },
            body
        );

        return response;
    },

    /**
     * run an html template through CGI process, inserting a set of parameters in the template.
     * returns a new html document with the inserted values.
     *
     * @param data {Buffer<string>} The original html template, as a Buffer of bytes which represent an html string.
     * @param params {Object} A set of key-value pairs. The values will be inserted in the html wherever the corresponding key is found.
     * @returns {Buffer<string>} The modified html.
     */
    runCGI(data, params) {
        let template = data.toString();
        Object.keys(params).forEach(key => {
            if (template.indexOf(`%%${key}%%`) >= 0) {
                template = template.replace(`%%${key}%%`, params[key]);
            }
        });

        return Buffer.from(template);
    },

    /**
     * clear the body of a response, leaving the headers only
     *
     * @param res {Object} A response object
     * @returns {Object} Modified response object
     */
    clearResponseBody(res) {
        return Object.assign({}, res, {body: null});
    },

    /**
     * parse the body of a request with content type 'application/x-www-form-urlencoded'
     *
     * @param body {Object} An object with a key-value pair for each property in the body
     */
    parseFormUrlEncoded(body) {
        const properties = {};
        body.split('&').forEach(prop => {
            const parts = prop.split('=')
                .map(part => decodeURIComponent(part.replace(/\+/g, '%20')));
            properties[parts[0]] = parts[1];
        });

        return properties;
    },

    /**
     * get resource name out of a request
     * if url is '/' resource name is '/index.html'
     *
     * @param req {Object} A request object
     * @returns {string}
     */
    getReqResourceName(req) {
        let resourceName = req.resource.substring(1);
        if (resourceName === '')
            resourceName = 'index.html';
        return resourceName;
    },

    /**
     * convert a string representing a list of mime types into an array of mime types
     *
     * @param mimeTypesAsString {string}
     * @returns {string[]}
     */
    parseMimeTypeList(mimeTypesAsString) {
        return mimeTypesAsString
            .split(',')
            .map(type => {
                const typeParts = this.getMimeTypeParts(type);
                return `${typeParts[0]}/${typeParts[1]}`;
            });
    },

    /**
     * check if a given mime type is contained within a list of accepted mime types
     *
     * if the list of accepted mime types contains '*\/*' (any) then the given mime type is accepted
     *
     * @param resourceMimeType {string} The given mime type to check
     * @param acceptedMimeTypes {string[]} The mime types to check against
     * @returns {boolean}
     */
    mimeTypeIsAccepted(resourceMimeType, acceptedMimeTypes) {
        if (acceptedMimeTypes.indexOf(resourceMimeType) === -1 && acceptedMimeTypes.indexOf('*/*') === -1)
            return false;
        return true;
    },

    /**
     * split a mime type into its type and subtype.
     * parameters after an ';' are eliminated.
     *
     * example:
     * getMimeTypeParts('text/html;q=10') : ['text', 'html']
     *
     * @param mimeType {string} A mime type
     * @returns {string[]} An array with the mime parts as elements
     */
    getMimeTypeParts(mimeType) {
        let parsedType = mimeType.trim();
        if (parsedType.indexOf(';') >= 0)
            parsedType = parsedType.substring(0, parsedType.indexOf(';'));

        return parsedType.split('/');
    },

    mimeTypeIsHtml(mimeType) {
        const mimeParts = this.getMimeTypeParts(mimeType);
        if (mimeParts[0] === 'text' && mimeParts[1] === 'html')
            return true;
        return false;
    },

    printBufferBytes(buf) {
        for(const [i, b] of buf.entries()) {
            console.log(`${i}:\t ${b}`);
        }
    }

};
