/*
*    IE Tab API support.
*    This code runs in the background page and provides support for the IE Tab API.
*    The bulk of this support involves displaying a prompt for requesting API access.
*
*/
var IETabApi = {
    REQUESTWINDOW_TIMEOUT: 300000,
    API_POPUP_STARTWIDTH: 460,
    API_POPUP_STARTHEIGHT: 220,

    apiRequestWindows: {},

    cleanupApiRequestWindows: function() {
        var now = (new Date()).getTime();
        for (var id in this.apiRequestWindows) {
            var entry = this.apiRequestWindows[id];
            if (now - entry.created > this.REQUESTWINDOW_TIMEOUT) {
                chrome.windows.remove(entry.windowId);
                delete this.apiRequestWindows[id];
            }
        }
    },

    // Checks whether api access should be granted.  If so, responds immediately.
    // May prompt the user for access if the url is not whitelisted or blacklisted.
    // Returns true if an asynchronous response is expected, false otherwise.
    onRequestIETabApiAccess: function(request, sender, fnResponse) {
        // Check whether this URL is blacklisted
        if (Background.listMatch(sender.tab.url, 'api-blacklist')) {
            fnResponse(false);
            return false;
        }
        // Check whether this URL is already confirmed
        if (Background.listMatch(sender.tab.url, 'api-whitelist')) {
            fnResponse(true);
            return false;
        }

        // If admin doesn't allow API prompts or they are requesting access silently, then we're done
        if (request.silent || !Settings.get('allow-api-prompt')) {
            fnResponse(false);
            return false;
        }

        // Permission is not yet granted, display a prompt asking the user if they want to allow
        // API access.
        chrome.windows.get(sender.tab.windowId, function(parentWindow) {
            var url = chrome.extension.getURL('api_request.html');
            var id = Math.floor(Math.random() * 1000000);
            url += '?rid=' + id;

            // Center the window horizontally
            var createParams = {
                type: 'popup',
                url: url,
                left: parseInt(parentWindow.left + (parentWindow.width - this.API_POPUP_STARTWIDTH) / 2),
                top: parentWindow.top + 150,
                width: this.API_POPUP_STARTWIDTH,
                height: this.API_POPUP_STARTHEIGHT
            }

            chrome.windows.create(createParams, function(newWindow) {
                this.apiRequestWindows[id] = {
                    windowId: newWindow.id,
                    created: (new Date()).getTime(),
                    fnResponse: fnResponse,
                    requestingUrl: sender.tab.url,
                    parentWindowId: sender.tab.windowId
                }
                window.setTimeout(function() {
                    this.cleanupApiRequestWindows();
                }.bind(this), this.REQUESTWINDOW_TIMEOUT + 1000);
            }.bind(this));
        }.bind(this));

        return true;
    },

    getSiteFilterFromUrl: function(url) {
        var parts = Utils.parseUrl(url);
        return parts.protocol + '//' + parts.host + "/*";
    },

    addApiWhitelist: function(url) {
        var filter = this.getSiteFilterFromUrl(url);
        var whitelist = Settings.get('local-api-whitelist');
        if (!whitelist)
            whitelist = [];
        whitelist.push(filter);
        Settings.set('local-api-whitelist', whitelist);
    },

    addApiBlacklist: function(url) {
        var filter = this.getSiteFilterFromUrl(url);
        var blacklist = Settings.get('local-api-blacklist');
        if (!blacklist)
            blacklist = [];
        blacklist.push(filter);
        Settings.set('local-api-blacklist', blacklist);
    },

    onApiRequestResult: function(resultId, allow, always) {
        var entry = this.apiRequestWindows[resultId];
        if (!entry)
            return;

        if (always) {
            if (allow)
                this.addApiWhitelist(entry.requestingUrl);
            else
                this.addApiBlacklist(entry.requestingUrl);
        }

        // Notify the calling web page and clean up
        if (entry.fnResponse) {
            entry.fnResponse(allow);
            // Null out the response object so we don't call it again on window removal
            entry.fnResponse = null;
        }
        delete this.apiRequestWindows[resultId];
        chrome.windows.remove(entry.windowId);
    },

    onWindowRemoved: function(windowId) {
        // If this is an active API request window, then respond with "Deny".
        for (var requestId in this.apiRequestWindows) {
            var entry = this.apiRequestWindows[requestId];
            if (entry.windowId == windowId) {
                this.onApiRequestResult(requestId, false, false);
                break;
            }
        }
    },

    onOpenWithIETab: function(sender, request) {
        var tabId = request.newTab ? null : sender.tab.id;
        Background.openWithIETab(tabId, request.url);
    },

    onGetVersion: function(fnResponse) {
        fnResponse(chrome.runtime.getManifest().version);
    },

    onIETabApiRequest: function(request, sender, fnResponse) {
        switch(request.type) {
            case 'REQUEST_ACCESS':
                return this.onRequestIETabApiAccess(request, sender, fnResponse);
            case 'OPEN_WITH_IETAB':
                this.onOpenWithIETab(sender, request);
                break;
            case 'GET_VERSION':
                this.onGetVersion(fnResponse);
                break;
        }
        // If you expect an asynch response then return true
        return false;
    },

    init: function() {
        chrome.windows.onRemoved.addListener(function(windowId) {
            this.onWindowRemoved(windowId);
        }.bind(this));
    }

}

IETabApi.init();
