/*
 * This content script provides the extension API to ietab.net web pages
 */
var ExtensionApi = {
    requestNumber: 0,
    waitingCalls: {},
    MAX_RESPONSE_WAIT: 30000,

    postResponse: function(requestNumber, data) {
        var wrappedRequest = {
            type: 'EXTAPI_RESPONSE',
            src: 'CS',
            responseNumber: requestNumber,
            data: data
        }

        window.postMessage(wrappedRequest, document.location.origin);
    },

    initOptionsPage: function() {
        var elExtra = document.getElementById('get-extra-perms');
        if (elExtra) {
            elExtra.addEventListener('click', function() {
                chrome.runtime.sendMessage({ type: 'REQUEST_PERMISSIONS' }, function(permissions) {
                    if (permissions && permissions.other) {
                        alert('Thanks!  IE Tab will now perform early interception for all https Auto URLs');
                        document.getElementById('grant-https').style.display = 'none';
                    }
                });
            }, false);
        }
    },

    init: function() {
        var script = document.createElement('script');
        var url = chrome.extension.getURL('js/extapi_wp.js');
        script.src = url;
        document.documentElement.appendChild(script);

        // Listen for posted extension api messages from the web page and send them to the background page
        var self = this;
        window.addEventListener('message', function(event) {
            if (event.origin !== document.location.origin)
                return;

            if (!event.data || !event.data.src || !event.data.type)
                return;

            // Make sure it's from the web page
            if (event.data.src != 'WP')
                return;

            if (event.data.type == 'EXTAPI_REQUEST') {
                var fnResponse;
                if (event.data.requestNumber) {
                    fnResponse = function(data) {
                        self.postResponse(event.data.requestNumber, data);
                    }
                }
                // It's ready, send the request
                if (fnResponse)
                    chrome.extension.sendMessage(event.data, fnResponse);
                else
                    chrome.extension.sendMessage(event.data);
                return;
            }

            // Is it a response?
            if (event.data.type == 'EXTAPI_RESPONSE') {
                if (self.waitingCalls[event.data.responseNumber]) {
                    // Call the response function and delete the waiting entry
                    (self.waitingCalls[event.data.responseNumber])(event.data);
                    delete self.waitingCalls[event.data.responseNumber];
                    return;
                }
            }

        }, false);

        // Listen for extension api messages from the background page and post them to the web page
        chrome.runtime.onMessage.addListener(function(request, sender, fnResponse) {
            if (request.type == 'EXTAPI_REQUEST') {
                request.src = 'CS';
                window.postMessage(request, document.location.origin);
            }
        });
    }
}

ExtensionApi.init();

window.addEventListener('load', function() {
    ExtensionApi.initOptionsPage();
});
