/*
 * This script provides the extension api to the background page
 */
var ExtensionApi = {
    broadcastRequest: function(request) {
        // Broadcast the message to any tabs with an extension api listener
        chrome.tabs.query({}, function(tabs) {
            for (var i=0; i<tabs.length; ++i) {
                chrome.tabs.sendMessage(tabs[i].id, { type: 'EXTAPI_REQUEST', request: request });
            }
        });
    },

    _init: function() {
        Debug.log("ExtensionApi.init");
        var self = this;
        // Listen for extension api messages from the background page and post them to the web page
        chrome.extension.onMessage.addListener(function(request, sender, fnResponse) {
            Debug.log("ExtensionApi.onMessage: " + JSON.stringify(request));
            if (request.type == 'EXTAPI_REQUEST') {
                if (self.onRequest) {
                    return self.onRequest(sender, request.request, fnResponse);
                }
            }
        });
    }
}

ExtensionApi._init();
