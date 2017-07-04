/*
 * This script provides the extension api to ietab.net web pages.
 * This portion runs in the web page (not as a content script)
 */
var ExtensionApi = {
    requestNumber: 0,
    waitingCalls: {},
    MAX_RESPONSE_WAIT: 30000,

    _sendResponse: function(requestNumber, data) {
        var wrappedRequest = {
            type: 'EXTAPI_RESPONSE',
            src: 'WP',
            responseNumber: requestNumber,
            data: data
        }
        window.postMessage(wrappedRequest, document.location.origin);
    },

    sendRequest: function(request, fnResponse) {
        var wrappedRequest = {
            type: 'EXTAPI_REQUEST',
            request: request
        }
        var requestNumber;
        var self = this;

        if (fnResponse) {
            // Wait for the response
            requestNumber = ++this.requestNumber;
            wrappedRequest.requestNumber = requestNumber;
            this.waitingCalls[requestNumber] = fnResponse;
            // Cleanup if it doesn't arrive in a certain amount of time
            window.setTimeout(function() {
                if (self.waitingCalls[requestNumber])
                    delete self.waitingCalls[requestNumber];
            }, this.MAX_RESPONSE_WAIT);
        }
        wrappedRequest.src = 'WP';
        window.postMessage(wrappedRequest, document.location.origin);
    },

    _init: function() {
        var self = this;
        window.addEventListener('message', function(event) {
            if (event.origin !== document.location.origin)
                return;

            if (!event.data || !event.data.src || !event.data.type)
                return;

            // Make sure it's from the content script
            if (event.data.src != 'CS')
                return;

            // Is this a request?
            if (event.data.type == 'EXTAPI_REQUEST') {
                // See if they are expecting a response
                var fnResponse;
                if (event.data.requestNumber) {
                    fnResponse = function(data) {
                        self._sendResponse(event.data.requestNumber, data);
                    }
                }
                if (self.onRequest)
                    self.onRequest(event.data.request, fnResponse);
                return;
            }

            // Is this a response?
            if (event.data.type == 'EXTAPI_RESPONSE') {
                if (self.waitingCalls[event.data.responseNumber]) {
                    // Call the response function and delete the waiting entry
                    (self.waitingCalls[event.data.responseNumber])(event.data.data);
                    delete self.waitingCalls[event.data.responseNumber];
                    return;
                }
            }
        }, false);
    }
}

ExtensionApi._init();
