/*
 * This script provides the ietab api to pages that have permission to access it.
 * This portion runs in the web page (not as a content script)
 */

(function() {
    var IETabApi = {
        requestNumber: 0,
        waitingCalls: {},
        MAX_RESPONSE_WAIT: 300000,

        PUBLIC_METHODS: [ 'getVersion', 'openWithIETab', 'requestAccess' ],

        getVersion: function(fnResponse) {
            this._sendRequest({ type: 'GET_VERSION' }, fnResponse);
        },

        requestAccess: function(silent, fnResponse) {
            // silent is optional
            if (typeof(silent) == "function") {
                fnResponse = silent;
                silent = false;
            }
            this._sendRequest({ type: 'REQUEST_ACCESS', silent: silent }, fnResponse);
        },

        openWithIETab: function(url, newTab) {
            this._sendRequest({ type: 'OPEN_WITH_IETAB', url: url, newTab: newTab });
        },

        _sendRequest: function(request, fnResponse) {
            var wrappedRequest = {
                type: 'IETABAPI_REQUEST',
                request: request
            }
            var requestNumber;

            if (fnResponse) {
                // Wait for the response
                requestNumber = ++this.requestNumber;
                wrappedRequest.requestNumber = requestNumber;
                this.waitingCalls[requestNumber] = fnResponse;
                // Cleanup if it doesn't arrive in a certain amount of time
                window.setTimeout(function() {
                    if (this.waitingCalls[requestNumber])
                        delete self.waitingCalls[requestNumber];
                }.bind(this), this.MAX_RESPONSE_WAIT);
            }
            wrappedRequest.src = 'WP';
            window.postMessage(wrappedRequest, document.location.origin);
        },

        _init: function() {
            window.addEventListener('message', function(event) {
                if (event.origin !== document.location.origin)
                    return;

                if (!event.data || !event.data.src || !event.data.type)
                    return;

                // Make sure it's from the content script
                if (event.data.src != 'CS')
                    return;

                // Is this a request?
                if (event.data.type == 'IETABAPI_REQUEST') {
                    // See if they are expecting a response
                    var fnResponse;
                    if (event.data.requestNumber) {
                        fnResponse = function(data) {
                            this._sendResponse(event.data.requestNumber, data);
                        }
                    }
                    if (this.onRequest)
                        this.onRequest(event.data.request, fnResponse);
                    return;
                }

                // Is this a response?
                if (event.data.type == 'IETABAPI_RESPONSE') {
                    if (this.waitingCalls[event.data.responseNumber]) {
                        // Call the response function and delete the waiting entry
                        (this.waitingCalls[event.data.responseNumber])(event.data.data);
                        delete this.waitingCalls[event.data.responseNumber];
                        return;
                    }
                }
            }.bind(this), false);

            // Initialize the public API object
            window.ietab = {};
            for (var i = 0; i<this.PUBLIC_METHODS.length; i++) {
                var methodName = this.PUBLIC_METHODS[i];
                window.ietab[methodName] = IETabApi[methodName].bind(IETabApi);
            }
        }
    }

    IETabApi._init();
})();
